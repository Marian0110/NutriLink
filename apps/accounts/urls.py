from django.urls import path
from . import views

app_name = 'accounts'

urlpatterns = [
    path('registro/', views.registro, name='registro'),
    path('login/', views.login, name='login'),
    path('perfil/', views.perfil, name='perfil'),
    path('dashboard/', views.dashboard, name='dashboard'),

]