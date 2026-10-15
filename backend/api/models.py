import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models


SUPPORTED_CURRENCIES = {
    'BRL': 'Real brasileiro',
    'USD': 'Dólar americano',
}


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, name, password=None, **extra_fields):
        if not email:
            raise ValueError('O e-mail e obrigatorio.')
        if not name:
            raise ValueError('O nome e obrigatorio.')

        user = self.model(
            email=self.normalize_email(email),
            name=name,
            **extra_fields,
        )
        if password is not None:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, name, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superusuario precisa ter is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superusuario precisa ter is_superuser=True.')

        return self.create_user(email, name, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    email = models.EmailField(max_length=255, unique=True)
    password = models.CharField(max_length=255, db_column='password_hash')
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    class Meta:
        db_table = 'users'
        ordering = ['created_at']

    def __str__(self):
        return self.email


class Group(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    currency = models.CharField(
        max_length=3,
        choices=SUPPORTED_CURRENCIES.items(),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    members = models.ManyToManyField(
        User,
        through='GroupMembership',
        related_name='expense_groups',
    )

    class Meta:
        db_table = 'expense_groups'
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class GroupMembership(models.Model):
    class Role(models.TextChoices):
        ADMIN = 'admin', 'Administrador'
        MEMBER = 'member', 'Integrante'

    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name='memberships',
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='group_memberships',
    )
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'group_memberships'
        constraints = [
            models.UniqueConstraint(
                fields=['group', 'user'],
                name='unique_group_membership',
            ),
        ]
        ordering = ['joined_at']

    def __str__(self):
        return f'{self.user.email} - {self.group.name}'


class Expense(models.Model):
    class SplitType(models.TextChoices):
        EQUAL = 'equal', 'Igualitário'
        AMOUNT = 'amount', 'Valores definidos'
        PERCENTAGE = 'percentage', 'Percentuais'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name='expenses',
    )
    description = models.CharField(max_length=120)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    paid_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='paid_expenses',
    )
    split_type = models.CharField(max_length=10, choices=SplitType.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'expenses'
        ordering = ['-created_at']

    def __str__(self):
        return self.description


class ExpenseShare(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    expense = models.ForeignKey(
        Expense,
        on_delete=models.CASCADE,
        related_name='shares',
    )
    user = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='expense_shares',
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
    )

    class Meta:
        db_table = 'expense_shares'
        constraints = [
            models.UniqueConstraint(
                fields=['expense', 'user'],
                name='unique_expense_share_user',
            ),
        ]
        ordering = ['user__name']

    def __str__(self):
        return f'{self.user.name} - {self.expense.description}'


class GroupPayment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name='payments',
    )
    paid_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='payments_made',
    )
    paid_to = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='payments_received',
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'group_payments'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.paid_by.name} pagou {self.amount} para {self.paid_to.name}'
