"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path

from api.views import (
    GroupListCreateView,
    GroupExpenseListCreateView,
    GroupMemberListCreateView,
    UserRegistrationView,
    available_currencies,
    csrf_token,
    current_user,
    health_check,
    logout_user,
    UserLoginView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='api-health'),
    path('api/auth/csrf/', csrf_token, name='api-csrf'),
    path('api/auth/login/', UserLoginView.as_view(), name='api-login'),
    path('api/auth/session/', current_user, name='api-session'),
    path('api/auth/logout/', logout_user, name='api-logout'),
    path('api/groups/currencies/', available_currencies, name='api-group-currencies'),
    path('api/groups/', GroupListCreateView.as_view(), name='api-groups'),
    path(
        'api/groups/<uuid:group_id>/expenses/',
        GroupExpenseListCreateView.as_view(),
        name='api-group-expenses',
    ),
    path(
        'api/groups/<uuid:group_id>/members/',
        GroupMemberListCreateView.as_view(),
        name='api-group-members',
    ),
    path(
        'api/auth/register/',
        UserRegistrationView.as_view(),
        name='api-register',
    ),
]
