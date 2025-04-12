from django.shortcuts import render
from django.conf import settings

# Create your views here.
def gestion(request):
    print("BASE_DIR:", settings.BASE_DIR)
    return render(request, 'patients/gestion.html')

def infoGeneral(request):
    return render(request, 'patients/info-general.html', {'section': 'general'})

def historialClinico(request):
    return render(request, 'patients/historial-clinico.html', {'section': 'historial-clinico'})