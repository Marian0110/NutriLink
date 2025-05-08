from django.shortcuts import render
import requests
from django.conf import settings
from django.http import Http404
from datetime import datetime
from django.core.cache import cache
from requests.exceptions import RequestException

# Create your views here.
def gestion(request):
    print("BASE_DIR:", settings.BASE_DIR)
    return render(request, 'patients/gestion.html')
    
def get_paciente_data(id_paciente):
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
    try:
        paciente = get_paciente_data(id_paciente)
        # Obtener factores patológicos
        success, factores_patologicos, error = get_factores_patologicos()
        
        if not success:
            print(f"Error al obtener factores patológicos: {error}")  # Para depuración
        
        return render(request, 'patients/historial-clinico.html', {
            'paciente': paciente,
            'factores_patologicos': factores_patologicos if success else [],
            'section': 'historial-clinico'
        })
        
    except Exception as e:
        raise Http404(f"Error al cargar historial clínico: {str(e)}")

def metricas(request, id_paciente):
    paciente = get_paciente_data(id_paciente)
    return render(request, 'patients/metricas.html', {
        'paciente': paciente,
        'section': 'metricas'
    })

def infoGeneral(request, id_paciente):
    paciente = get_paciente_data(id_paciente)
    credenciales = get_credenciales(id_paciente)

    return render(request, 'patients/info-general.html', {
        'paciente': paciente,
        'credenciales': credenciales,
        'section': 'info-general'
    })

def get_credenciales(id_paciente):
    try:
        url = f'https://nutrilinkapi-production.up.railway.app/api_nutrilink/paciente/credenciales/{id_paciente}'
        response = requests.get(url)

        if response.status_code == 200:
            data = response.json()
            return {
                'correo': data.get('correo'),
                'contrasena': data.get('contrasena')
            }
        else:
            print(f'Error al obtener credenciales: {response.status_code} - {response.text}')
            return None
    except requests.RequestException as e:
        print(f'Excepción al conectar con el endpoint de credenciales: {e}')
        return None
    
def get_factores_patologicos():
    """
    Obtiene todos los factores patológicos desde la API Node.js
    
    Returns:
        tuple: (success: bool, data: list, error: str)
    """
    url = 'https://nutrilinkapi-production.up.railway.app/api_nutrilink/obtener_factor_patologico'
    timeout = 10
    
    try:
        response = requests.get(url, timeout=timeout)
        
        # Verificar si la respuesta fue exitosa
        if response.status_code == 200:
            data = response.json()
            # Asegurarnos de que la estructura de datos es correcta
            if isinstance(data, dict) and 'data' in data and 'rows' in data['data']:
                return True, data['data']['rows'], None
            return False, [], "Estructura de respuesta inválida"
        else:
            error_msg = response.json().get('mensaje', 'Error desconocido')
            return False, [], f"Error en la API: {error_msg}"
            
    except RequestException as e:
        return False, [], f"Error de conexión: {str(e)}"
    except ValueError as e:
        return False, [], f"Error procesando respuesta: {str(e)}"
    except Exception as e:
        return False, [], f"Error inesperado: {str(e)}"