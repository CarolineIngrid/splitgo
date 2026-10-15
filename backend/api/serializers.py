from decimal import Decimal

from django.db import transaction
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import (
    Expense,
    ExpenseShare,
    Group,
    GroupMembership,
    GroupPayment,
    SUPPORTED_CURRENCIES,
    User,
)


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    class Meta:
        model = User
        fields = ('id', 'name', 'email', 'password', 'created_at')
        read_only_fields = ('id', 'created_at')

    def validate(self, attrs):
        candidate = User(name=attrs['name'], email=attrs['email'])
        try:
            validate_password(attrs['password'], user=candidate)
        except DjangoValidationError as error:
            raise serializers.ValidationError(
                {'password': error.messages}
            ) from error
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class GroupMemberSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source='user.id', read_only=True)
    name = serializers.CharField(source='user.name', read_only=True)
    is_current_user = serializers.SerializerMethodField()

    class Meta:
        model = GroupMembership
        fields = ('id', 'user_id', 'name', 'role', 'joined_at', 'is_current_user')

    def get_is_current_user(self, membership):
        request = self.context.get('request')
        return bool(
            request
            and request.user.is_authenticated
            and membership.user_id == request.user.pk
        )


class AvailableGroupMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'name', 'email')


class AddGroupMemberSerializer(serializers.Serializer):
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='user',
    )


class GroupSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    currency = serializers.CharField(max_length=3)
    members = GroupMemberSerializer(source='memberships', many=True, read_only=True)

    class Meta:
        model = Group
        fields = ('id', 'name', 'currency', 'role', 'created_at', 'members')
        read_only_fields = ('id', 'role', 'created_at')

    def validate_currency(self, value):
        currency = value.strip().upper()
        if currency not in SUPPORTED_CURRENCIES:
            raise serializers.ValidationError(
                'Selecione real brasileiro (BRL) ou dólar americano (USD).'
            )
        return currency

    def get_role(self, group):
        request = self.context.get('request')
        if request is None or not request.user.is_authenticated:
            return None
        return next(
            (
                membership.role
                for membership in group.memberships.all()
                if membership.user_id == request.user.pk
            ),
            None,
        )

    @transaction.atomic
    def create(self, validated_data):
        group = Group.objects.create(**validated_data)
        GroupMembership.objects.create(
            group=group,
            user=self.context['request'].user,
            role=GroupMembership.Role.ADMIN,
        )
        return group


class ExpenseParticipantInputSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()
    value = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
    )


class ExpenseCreateSerializer(serializers.ModelSerializer):
    paid_by = serializers.UUIDField()
    participants = ExpenseParticipantInputSerializer(many=True, min_length=1)

    class Meta:
        model = Expense
        fields = ('description', 'amount', 'paid_by', 'split_type', 'participants')

    def validate_description(self, value):
        description = value.strip()
        if not description:
            raise serializers.ValidationError('Informe a descrição da despesa.')
        return description

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('O valor da despesa deve ser maior que zero.')
        return value

    def validate(self, attrs):
        group = self.context['group']
        split_type = attrs['split_type']
        participants = attrs['participants']
        participant_ids = [item['user_id'] for item in participants]

        if len(participant_ids) != len(set(participant_ids)):
            raise serializers.ValidationError({
                'participants': 'Não repita participantes no rateio.',
            })

        # A pessoa que paga e cada participante precisam pertencer a este grupo.
        member_ids = set(
            GroupMembership.objects.filter(
                group=group,
                user_id__in=participant_ids + [attrs['paid_by']],
            ).values_list('user_id', flat=True)
        )
        if attrs['paid_by'] not in member_ids:
            raise serializers.ValidationError({
                'paid_by': 'Quem pagou precisa participar do grupo.',
            })
        if any(user_id not in member_ids for user_id in participant_ids):
            raise serializers.ValidationError({
                'participants': 'Todos os participantes do rateio precisam fazer parte do grupo.',
            })

        if split_type == Expense.SplitType.EQUAL:
            if any('value' in participant for participant in participants):
                raise serializers.ValidationError({
                    'participants': 'Não informe valores em um rateio igualitário.',
                })
        else:
            if any('value' not in participant for participant in participants):
                raise serializers.ValidationError({
                    'participants': 'Informe o valor de cada participante.',
                })
            if any(participant['value'] <= 0 for participant in participants):
                raise serializers.ValidationError({
                    'participants': 'Cada parcela deve ser maior que zero.',
                })

            values_total = sum(
                (participant['value'] for participant in participants),
                start=Decimal('0'),
            )
            expected_total = (
                attrs['amount']
                if split_type == Expense.SplitType.AMOUNT
                else Decimal('100')
            )
            if values_total != expected_total:
                expected_label = 'o valor total da despesa' if split_type == Expense.SplitType.AMOUNT else '100%'
                raise serializers.ValidationError({
                    'participants': f'A soma das parcelas deve corresponder a {expected_label}.',
                })

        return attrs

    # O lançamento e todas as parcelas são persistidos juntos ou não são persistidos.
    @transaction.atomic
    def create(self, validated_data):
        participants = validated_data.pop('participants')
        group = self.context['group']
        expense = Expense.objects.create(
            group=group,
            paid_by=User.objects.get(pk=validated_data.pop('paid_by')),
            **validated_data,
        )
        shares = self._build_shares(expense, participants)
        ExpenseShare.objects.bulk_create([
            ExpenseShare(
                expense=expense,
                user=user,
                amount=amount,
                percentage=percentage,
            )
            for user, amount, percentage in shares
        ])
        return expense

    @staticmethod
    def _build_shares(expense, participants):
        # Calcular em centavos inteiros evita erros de arredondamento em dinheiro.
        total_cents = int(expense.amount * 100)
        # Buscar os usuários em lote evita uma consulta individual por parcela.
        users = {
            str(user.id): user
            for user in User.objects.filter(
                pk__in=[participant['user_id'] for participant in participants],
            )
        }
        if expense.split_type == Expense.SplitType.EQUAL:
            base, remainder = divmod(total_cents, len(participants))
            # Distribuir os centavos restantes na ordem informada mantém a soma exata.
            return [
                (
                    users[str(participant['user_id'])],
                    Decimal(base + int(index < remainder)) / Decimal('100'),
                    None,
                )
                for index, participant in enumerate(participants)
            ]

        if expense.split_type == Expense.SplitType.AMOUNT:
            return [
                (users[str(participant['user_id'])], participant['value'], None)
                for participant in participants
            ]

        percentage_units = [
            int(participant['value'] * 100)
            for participant in participants
        ]
        raw_shares = [
            (total_cents * units) // 10000
            for units in percentage_units
        ]
        remaining_cents = total_cents - sum(raw_shares)
        # Os centavos fracionários maiores recebem os centavos que faltam.
        remainder_order = sorted(
            range(len(participants)),
            key=lambda index: (
                -(total_cents * percentage_units[index] % 10000),
                index,
            ),
        )
        for index in remainder_order[:remaining_cents]:
            raw_shares[index] += 1

        return [
            (
                users[str(participant['user_id'])],
                Decimal(raw_shares[index]) / Decimal('100'),
                participant['value'],
            )
            for index, participant in enumerate(participants)
        ]


class ExpenseShareSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source='user.id', read_only=True)
    name = serializers.CharField(source='user.name', read_only=True)

    class Meta:
        model = ExpenseShare
        fields = ('user_id', 'name', 'amount', 'percentage')


class ExpenseDetailSerializer(serializers.ModelSerializer):
    paid_by_id = serializers.UUIDField(source='paid_by.id', read_only=True)
    paid_by_name = serializers.CharField(source='paid_by.name', read_only=True)
    participants = ExpenseShareSerializer(source='shares', many=True, read_only=True)

    class Meta:
        model = Expense
        fields = (
            'id',
            'description',
            'amount',
            'paid_by_id',
            'paid_by_name',
            'split_type',
            'participants',
            'created_at',
        )


class GroupPaymentCreateSerializer(serializers.ModelSerializer):
    paid_by = serializers.UUIDField()
    paid_to = serializers.UUIDField()

    class Meta:
        model = GroupPayment
        fields = ('description', 'amount', 'paid_by', 'paid_to')

    def validate_description(self, value):
        description = value.strip()
        if not description:
            return 'Pagamento'
        return description

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('O valor do pagamento deve ser maior que zero.')
        return value

    def _pairwise_debts(self, group):
        debts = {}
        for expense in group.expenses.select_related('paid_by').prefetch_related('shares__user'):
            payer_id = str(expense.paid_by_id)
            for share in expense.shares.all():
                debtor_id = str(share.user_id)
                if debtor_id == payer_id:
                    continue
                first_id, second_id = sorted([debtor_id, payer_id])
                key = (first_id, second_id)
                delta = Decimal(str(share.amount))
                debts[key] = debts.get(key, Decimal('0')) + (delta if debtor_id == first_id else -delta)

        for payment in group.payments.select_related('paid_by', 'paid_to'):
            payer_id = str(payment.paid_by_id)
            recipient_id = str(payment.paid_to_id)
            first_id, second_id = sorted([payer_id, recipient_id])
            key = (first_id, second_id)
            delta = Decimal(str(payment.amount))
            debts[key] = debts.get(key, Decimal('0')) - (delta if payer_id == first_id else -delta)

        return debts

    def validate(self, attrs):
        group = self.context['group']
        payer_id = str(attrs['paid_by'])
        recipient_id = str(attrs['paid_to'])

        if payer_id == recipient_id:
            raise serializers.ValidationError({
                'paid_to': 'O pagamento precisa ser emitido para outra pessoa do grupo.',
            })

        member_ids = set(
            GroupMembership.objects.filter(
                group=group,
                user_id__in=[attrs['paid_by'], attrs['paid_to']],
            ).values_list('user_id', flat=True)
        )
        if attrs['paid_by'] not in member_ids:
            raise serializers.ValidationError({
                'paid_by': 'Quem pagou precisa participar do grupo.',
            })
        if attrs['paid_to'] not in member_ids:
            raise serializers.ValidationError({
                'paid_to': 'Quem recebeu o pagamento precisa participar do grupo.',
            })

        pair_key = tuple(sorted([payer_id, recipient_id]))
        pair_balance = self._pairwise_debts(group).get(pair_key, Decimal('0'))
        max_allowed = pair_balance if payer_id == pair_key[0] else -pair_balance
        max_allowed = max(Decimal('0'), max_allowed)

        if attrs['amount'] > max_allowed:
            raise serializers.ValidationError({
                'amount': f'Você só pode registrar até {max_allowed} {group.currency} neste pagamento.',
            })

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        group = self.context['group']
        return GroupPayment.objects.create(
            group=group,
            paid_by=User.objects.get(pk=validated_data.pop('paid_by')),
            paid_to=User.objects.get(pk=validated_data.pop('paid_to')),
            **validated_data,
        )


class GroupPaymentDetailSerializer(serializers.ModelSerializer):
    paid_by_id = serializers.UUIDField(source='paid_by.id', read_only=True)
    paid_by_name = serializers.CharField(source='paid_by.name', read_only=True)
    paid_to_id = serializers.UUIDField(source='paid_to.id', read_only=True)
    paid_to_name = serializers.CharField(source='paid_to.name', read_only=True)

    class Meta:
        model = GroupPayment
        fields = (
            'id',
            'description',
            'amount',
            'paid_by_id',
            'paid_by_name',
            'paid_to_id',
            'paid_to_name',
            'created_at',
        )
