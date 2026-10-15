from django.contrib.auth import authenticate, login, logout
from django.http import HttpResponse, JsonResponse
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .auth_serializers import AuthenticatedUserSerializer, LoginSerializer
from .models import Expense, Group, GroupMembership, SUPPORTED_CURRENCIES, User
from .serializers import (
    AddGroupMemberSerializer,
    AvailableGroupMemberSerializer,
    ExpenseCreateSerializer,
    ExpenseDetailSerializer,
    GroupMemberSerializer,
    GroupSerializer,
    UserRegistrationSerializer,
)


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


class GroupListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        groups = Group.objects.filter(
            memberships__user=request.user,
        ).prefetch_related('memberships__user').distinct()
        serializer = GroupSerializer(
            groups,
            many=True,
            context={'request': request},
        )
        return Response(serializer.data)

    def post(self, request):
        serializer = GroupSerializer(
            data=request.data,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        group = serializer.save()
        return Response(
            GroupSerializer(group, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class GroupExpenseListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get_group(self, group_id, user):
        # Filtrar pela participação impede consultar ou alterar grupos alheios.
        return Group.objects.filter(
            pk=group_id,
            memberships__user=user,
        ).first()

    def get(self, request, group_id):
        group = self.get_group(group_id, request.user)
        if group is None:
            return Response(
                {'detail': 'Grupo não encontrado.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        expenses = group.expenses.select_related('paid_by').prefetch_related(
            'shares__user',
        )
        return Response(ExpenseDetailSerializer(expenses, many=True).data)

    def post(self, request, group_id):
        group = self.get_group(group_id, request.user)
        if group is None:
            return Response(
                {'detail': 'Grupo não encontrado.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = ExpenseCreateSerializer(
            data=request.data,
            context={'group': group},
        )
        serializer.is_valid(raise_exception=True)
        expense = serializer.save()
        return Response(
            ExpenseDetailSerializer(expense).data,
            status=status.HTTP_201_CREATED,
        )


class GroupMemberListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get_group(self, group_id, user):
        # Somente integrantes atuais podem consultar ou alterar a composição do grupo.
        return Group.objects.filter(
            pk=group_id,
            memberships__user=user,
        ).first()

    def get(self, request, group_id):
        group = self.get_group(group_id, request.user)
        if group is None:
            return Response(
                {'detail': 'Grupo não encontrado.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        available_users = User.objects.exclude(
            group_memberships__group=group,
        ).order_by('name', 'email')
        return Response(
            AvailableGroupMemberSerializer(available_users, many=True).data,
        )

    def post(self, request, group_id):
        group = self.get_group(group_id, request.user)
        if group is None:
            return Response(
                {'detail': 'Grupo não encontrado.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = AddGroupMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership, created = GroupMembership.objects.get_or_create(
            group=group,
            user=serializer.validated_data['user'],
            defaults={'role': GroupMembership.Role.MEMBER},
        )
        return Response(
            GroupMemberSerializer(
                membership,
                context={'request': request},
            ).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


@api_view(['GET'])
def available_currencies(request):
    currencies = [
        {'code': code, 'name': name}
        for code, name in sorted(SUPPORTED_CURRENCIES.items())
    ]
    return Response(currencies)


@require_GET
@ensure_csrf_cookie
def csrf_token(request):
    return JsonResponse({'csrfToken': get_token(request)})


@method_decorator(csrf_protect, name='dispatch')
class UserLoginView(GenericAPIView):
    serializer_class = LoginSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAdminUser()]
        return [AllowAny()]

    def get(self, request):
        return Response({
            'name': 'api-login',
            'path': request.path,
            'method': 'POST',
            'description': 'Autentica um usuário e inicia uma sessão.',
            'request_body': {
                'email': 'E-mail cadastrado.',
                'password': 'Senha da conta.',
            },
        })

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            username=serializer.validated_data['email'],
            password=serializer.validated_data['password'],
        )
        if user is None:
            return Response(
                {'detail': 'E-mail ou senha inválidos.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        login(request, user)
        return Response({'user': AuthenticatedUserSerializer(user).data})


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
