from rest_framework import serializers

from .models import User


class AuthenticatedUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'name', 'email')
