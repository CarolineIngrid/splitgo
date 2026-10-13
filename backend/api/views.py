import json

from django.contrib.auth import authenticate, login, logout
from django.http import HttpResponse, JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .auth_serializers import AuthenticatedUserSerializer
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


@require_GET
@ensure_csrf_cookie
def csrf_token(request):
    return JsonResponse({'csrfToken': get_token(request)})


@require_POST
@csrf_protect
def login_user(request):
    try:
        credentials = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse(
            {'detail': 'O corpo da solicitação deve ser um JSON válido.'},
            status=400,
        )

    email = credentials.get('email') if isinstance(credentials, dict) else None
    password = credentials.get('password') if isinstance(credentials, dict) else None
    if not isinstance(email, str) or not isinstance(password, str):
        return JsonResponse(
            {'detail': 'Informe o e-mail e a senha.'},
            status=400,
        )

    user = authenticate(request, username=email, password=password)
    if user is None:
        return JsonResponse(
            {'detail': 'E-mail ou senha inválidos.'},
            status=400,
        )

    login(request, user)
    return JsonResponse({'user': AuthenticatedUserSerializer(user).data})


@api_view(['GET'])
def current_user(request):
    if not request.user.is_authenticated:
        return Response({'authenticated': False})
    return Response({
        'authenticated': True,
        'user': AuthenticatedUserSerializer(request.user).data,
    })


@require_POST
@csrf_protect
def logout_user(request):
    logout(request)
    return HttpResponse(status=204)
