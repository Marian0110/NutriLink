from django.shortcuts import render
import requests
from django.conf import settings
from django.http import Http404
from datetime import datetime

# Create your views here.
def gestion(request):
    print("BASE_DIR:", settings.BASE_DIR)
    return render(request, 'patients/gestion.html')
    
def get_patient_data(id_paciente):
    try: #construir api y hacer peticion
        api_url = f'https://nutrilinkapi-production.up.railway.app/api_nutrilink/paciente/{id_paciente}'
        response = requests.get(api_url, timeout=10)
        
        #verificar si la respuesta fue exitosa
        if response.status_code == 404:
            raise Http404("Paciente no encontrado")
        response.raise_for_status()
        
        paciente_data = response.json()
        #calcular edad
        fecha_nac = datetime.strptime(paciente_data['fechanac'], "%Y-%m-%d")
        edad = datetime.now().year - fecha_nac.year
        
        return {
            'id_paciente': paciente_data['id_paciente'],
            'nombre_completo': f"{paciente_data['primer_nombre']} {paciente_data.get('segundo_nombre', '')} {paciente_data['apellido_paterno']} {paciente_data.get('apellido_materno', '')}".strip(),
            'rut_paciente': f"{paciente_data['rut_paciente']}-{paciente_data['dv']}",
            'edad': edad,
            'sexo': 'Masculino' if paciente_data['sexo'] == 'M' else 'Femenino',
            'telefono': paciente_data.get('telefono', 'No especificado'),
            'correo': paciente_data['correo'],
            'fecha_nacimiento': paciente_data['fechanac']
        }
    except requests.Timeout:
        raise Http404("Tiempo de espera agotado al conectar con la API")
    except requests.RequestException as e:
        raise Http404(f"Error al obtener datos del paciente: {str(e)}")
    except (ValueError, KeyError) as e:
        raise Http404(f"Error en los datos: {str(e)}")

def historialClinico(request, id_paciente):
    paciente = get_patient_data(id_paciente)
    return render(request, 'patients/historial-clinico.html', {
        'paciente': paciente,
        'section': 'historial-clinico'
    })

def metricas(request, id_paciente):
    paciente = get_patient_data(id_paciente)
    return render(request, 'patients/metricas.html', {
        'paciente': paciente,
        'section': 'metricas'
    })

def infoGeneral(request, id_paciente):
    paciente = get_patient_data(id_paciente)
    return render(request, 'patients/info-general.html', {
        'paciente': paciente,
        'section': 'info-general'
    })