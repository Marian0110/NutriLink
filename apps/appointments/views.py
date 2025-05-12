from django.shortcuts import render

# Create your views here.
# apps/appointments/views.py
from django.shortcuts import render

def bdCrud(request):
    return render(request, 'appointments.html')