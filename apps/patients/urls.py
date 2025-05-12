from django.urls import path
from . import views

app_name = 'patients'

urlpatterns = [
    path('gestion/', views.gestion, name='gestion'),
    path('<int:id_paciente>/historial-clinico/', views.historialClinico, name='historial-clinico'),
    path('<int:id_paciente>/metricas/', views.metricas, name='metricas'),
    path('<int:id_paciente>/info-general/', views.infoGeneral, name='info-general'),
    path('<int:id_paciente>/registro-dietario/', views.registroDietario, name='registro-dietario'),
    path('<int:id_paciente>/minuta/', views.minuta, name='minuta'),
    path('info-general/<int:id_paciente>/enviar_credenciales/', views.enviar_credenciales, name='enviar_credenciales'),
]