from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User
from .serializers import UserRegistrationSerializer


@api_view(['GET'])
def health_check(request):
    return Response({
        'status': 'ok',
        'message': 'Conexão com o backend Django funcionando.',
    })


class UserRegistrationView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAdminUser()]
        return [AllowAny()]

    def get(self, request):
        users = User.objects.all()
        serializer = UserRegistrationSerializer(users, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            UserRegistrationSerializer(user).data,
            status=status.HTTP_201_CREATED,
        )
