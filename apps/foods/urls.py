from django.urls import path
from . import views

app_name = 'foods'

urlpatterns = [
    path('foods/', views.bdCrud, name='bdCrud'),

]