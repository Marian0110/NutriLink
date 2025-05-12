from django.shortcuts import render
import requests
from django.conf import settings
from django.http import Http404
from datetime import datetime
from django.core.cache import cache #futuro: para almacenar peticiones en cache por un tiempo def
from requests.exceptions import RequestException
from django.core.mail import send_mail # Para enviar emails
from django.contrib import messages  # Para mostrar alertas en el template
from django.http import JsonResponse

# Create your views here.
def gestion(request):
    print("BASE_DIR:", settings.BASE_DIR)
    return render(request, 'patients/gestion.html')
    
def get_paciente_data(id_paciente):
    try: #construir api y hacer peticion
        api_url = f'https://nutrilinkapi-production.up.railway.app/api_nutrilink/paciente/perfil/{id_paciente}'
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
        success, factores_patologicos, error = get_factores_patologicos()
        niveles_actividad = get_niveles_actividad_fisica()
        
        if not success:
            return render(request, 'patients/historial-clinico.html', {
                'paciente': paciente,
                'factores_patologicos': [],
                'error_factores': error,
                'niveles_actividad': niveles_actividad,
                'section': 'historial-clinico'
            })
        
        return render(request, 'patients/historial-clinico.html', {
            'paciente': paciente,
            'factores_patologicos': factores_patologicos,
            'niveles_actividad': niveles_actividad,
            'section': 'historial-clinico'
        })
        
    except Exception as e:
        print(f"Error en historialClinico: {str(e)}")
        raise Http404(f"Error al cargar historial clínico: {str(e)}")

def metricas(request, id_paciente):
    paciente = get_paciente_data(id_paciente)
    historial = get_historial_antropometrico(id_paciente)
    
    return render(request, 'patients/metricas.html', {
        'paciente': paciente,
        'historial_antropometrico': historial,
        'section': 'metricas'
    })
    
def minuta(request, id_paciente):
    paciente = get_paciente_data(id_paciente)
    
    return render(request, 'patients/minuta.html', {
        'paciente': paciente,
        'section': 'minuta'
    })

def registroDietario(request, id_paciente):
    paciente = get_paciente_data(id_paciente)
    
    return render(request, 'patients/registro-dietario.html', {
        'paciente': paciente,
        'section': 'registro-dietario'
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
    Returns requeridos:
        tuple: (success: bool, data: list, error: str)
    """
    url = 'http://nutrilinkapi-production.up.railway.app/api_nutrilink/requerimientos/obtener_factor_patologico'
    timeout = 10
    
    try:
        response = requests.get(url, timeout=timeout)
        response.raise_for_status()  # excepcion para codigos 4xx/5xx
        
        data = response.json()
        
        # Verificar estructura de respuesta
        if isinstance(data, dict) and data.get('status') == 'success':
            if isinstance(data.get('data'), list):
                return True, data['data'], None
            return False, [], "Estructura de datos inesperada"
            
        return False, [], "Respuesta no exitosa o formato incorrecto"
            
    except RequestException as e:
        return False, [], f"Error de conexión: {str(e)}"
    except ValueError as e:
        return False, [], f"Error procesando JSON: {str(e)}"
    except Exception as e:
        return False, [], f"Error inesperado: {str(e)}"

def get_historial_antropometrico(id_paciente):
    try:
        url = f'https://nutrilinkapi-production.up.railway.app/api_nutrilink/paciente/obtener_antropometria/{id_paciente}'
        response = requests.get(url)

        if response.status_code == 200:
            data = response.json()
            registros = data.get('datos', [])
            
            # Formato de fecha
            for registro in registros:
                if 'fecha' in registro and registro['fecha']:
                    registro['fecha'] = registro['fecha'].split('T')[0]
            
            return registros
        elif response.status_code == 404:
            return []
        else:
            print(f'Error al obtener antropometría: {response.status_code} - {response.text}')
            return []
    except requests.RequestException as e:
        print(f'Excepción al conectar con el endpoint de antropometría: {e}')
        return []

def get_niveles_actividad_fisica():
    """
    Obtiene los niveles de actividad física desde la API Node.js
    Devuelve directamente la lista de niveles o lista vacía si hay error
    """
    url = 'https://nutrilinkapi-production.up.railway.app/api_nutrilink/paciente/niveles_actividad_fisica'
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.json()  # devuelve directamente un array
    except Exception as e:
        print(f"Error obteniendo niveles actividad: {str(e)}")
        return []

#---------------------------- ENVIO DE CREDENCIALES PACIENTE ----------------------------
def enviar_credenciales(request, id_paciente):
    """
    Envio de las credenciales al paciente por correo electronico
    """
    paciente = get_paciente_data(id_paciente)
    credenciales = get_credenciales(id_paciente)

    if not credenciales:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'success': False, 'message': 'No se pudieron obtener las credenciales.'})
        messages.error(request, 'No se pudieron obtener las credenciales.')
        return render(request, 'patients/info-general.html', {
            'paciente': paciente,
            'credenciales': None,
            'section': 'info-general'
        })

    try:
        mensaje = f"""
Hola {paciente['nombre_completo']} 👋,

Has sido registrado por tu nutricionista en la app NutriLink.

Estas son tus credenciales de acceso:

📧 Correo: {credenciales['correo']}
🔐 Contraseña: {credenciales['contrasena']} (temporal)

Puedes cambiar tu contraseña una vez que ingreses.

📲 Descarga la app aquí:
https://nuestrositio.com/nutrilink.apk

¡Nos vemos dentro!
Equipo NutriLink
        """

        send_mail(
            subject='Tus credenciales para NutriLink',
            message=mensaje,
            from_email=None,
            recipient_list=[credenciales['correo']],
            fail_silently=False,
        )
        
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'success': True, 'message': 'Correo enviado correctamente.'})
        messages.success(request, 'Correo enviado correctamente.')
    except Exception as e:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'success': False, 'message': f'Ocurrió un error al enviar el correo: {e}'})
        messages.error(request, f'Ocurrió un error al enviar el correo: {e}')

    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({'success': True, 'message': 'Correo enviado correctamente.'})
    
    return render(request, 'patients/info-general.html', {
        'paciente': paciente,
        'credenciales': credenciales,
        'section': 'info-general'
    })