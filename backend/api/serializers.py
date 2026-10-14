from django.db import transaction
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Group, GroupMembership, SUPPORTED_CURRENCIES, User


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
    name = serializers.CharField(source='user.name', read_only=True)
    is_current_user = serializers.SerializerMethodField()

    class Meta:
        model = GroupMembership
        fields = ('id', 'name', 'role', 'joined_at', 'is_current_user')

    def get_is_current_user(self, membership):
        request = self.context.get('request')
        return bool(
            request
            and request.user.is_authenticated
            and membership.user_id == request.user.pk
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
