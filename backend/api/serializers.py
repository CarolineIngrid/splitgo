from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import User


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
