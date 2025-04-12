from django.urls import path
from . import views

app_name = 'patients'

urlpatterns = [
    path('gestion/', views.gestion, name='gestion'),
    path('info-general/', views.infoGeneral, name='info-general'),
    path('historial-clinico/', views.historialClinico, name='historial-clinico'),
    
]