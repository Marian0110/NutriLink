from django.shortcuts import render
import requests
from django.conf import settings
from django.http import Http404, JsonResponse, HttpResponse
from datetime import datetime
from django.core.cache import cache #futuro: para almacenar peticiones en cache por un tiempo def
from requests.exceptions import RequestException
from django.core.mail import send_mail, EmailMultiAlternatives # Para enviar emails
from django.contrib import messages  # Para mostrar alertas en el template
import json
import plotly.express as px
import plotly.io as pio
import pandas as pd

# Create your views here.
def gestion(request):
    print("BASE_DIR:", settings.BASE_DIR)
    return render(request, 'patients/gestion.html')
    
def get_paciente_data(id_paciente):
    try:
        api_url = f'https://nutrilinkapi-production.up.railway.app/api_nutrilink/paciente/perfil/{id_paciente}'
        response = requests.get(api_url, timeout=10)
        
        if response.status_code == 404:
            raise Http404("Paciente no encontrado")
        response.raise_for_status()
        
        paciente_data = response.json()
        fecha_nac = datetime.strptime(paciente_data['fechanac'], "%Y-%m-%d")
        edad = datetime.now().year - fecha_nac.year
        
        nombres = [paciente_data['primer_nombre']]
        if paciente_data.get('segundo_nombre'):
            nombres.append(paciente_data['segundo_nombre'])
        
        apellidos = [paciente_data['apellido_paterno']]
        if paciente_data.get('apellido_materno'):
            apellidos.append(paciente_data['apellido_materno'])
        
        nombre_completo = ' '.join(nombres + apellidos).strip()
        
        return {
            'id_paciente': paciente_data['id_paciente'],
            'nombre_completo': nombre_completo if nombre_completo else ' ',
            'rut_paciente': f"{paciente_data['rut_paciente']}-{paciente_data['dv']}",
            'edad': edad,
            'sexo': 'Masculino' if paciente_data['sexo'] == 'M' else 'Femenino',
            'telefono': paciente_data.get('telefono'),
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
        alimentos = get_alimentos()

        if not success:
            return render(request, 'patients/historial-clinico.html', {
                'paciente': paciente,
                'factores_patologicos': [],
                'error_factores': error,
                'niveles_actividad': niveles_actividad,
                'alimentos': alimentos,
                'section': 'historial-clinico'
            })

        return render(request, 'patients/historial-clinico.html', {
            'paciente': paciente,
            'factores_patologicos': factores_patologicos,
            'niveles_actividad': niveles_actividad,
            'alimentos': alimentos,
            'section': 'historial-clinico'
        })

    except Exception as e:
        print(f"Error en historialClinico: {str(e)}")
        raise Http404(f"Error al cargar historial clínico: {str(e)}")

def metricas(request, id_paciente):
    paciente = get_paciente_data(id_paciente)
    historial = get_historial_antropometrico(id_paciente)

    fechas_disponibles = sorted(list(set([registro['fecha'] for registro in historial if 'fecha' in registro])))

    fecha_seleccionada = request.GET.get('fecha')
    diagnosticos = None

    if fecha_seleccionada:
        diagnosticos = get_diagnosticos_antropometricos(id_paciente, fecha_seleccionada)

    # Preparar datos para los gráficos siempre que haya historial
    graficos_data = None
    if historial:
        # Convertir el historial a DataFrame
        df = pd.DataFrame(historial)

        # Convertir las columnas numéricas de string a float
        numeric_cols = ['peso_kg', 'talla_cm', 'porc_grasa']
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')  # Convierte a número, inválidos a NaN

        # Convertir la fecha a datetime
        df['fecha'] = pd.to_datetime(df['fecha'], errors='coerce')

        # Calculamos IMC si tenemos peso y talla
        if 'peso_kg' in df.columns and 'talla_cm' in df.columns:
            df['imc'] = df['peso_kg'] / ((df['talla_cm']/100)**2)

        # Eliminar filas con fechas inválidas
        df = df.dropna(subset=['fecha'])

        # Ordenar por fecha
        df = df.sort_values('fecha')

        # Crear gráficos
        graficos_data = {
            'imc': crear_grafico_evolucion(df, 'fecha', 'imc', 'IMC (kg/m²)'),
            'peso': crear_grafico_evolucion(df, 'fecha', 'peso_kg', 'Peso (kg)'),
            'grasa': crear_grafico_evolucion(df, 'fecha', 'porc_grasa', '% Grasa corporal'),
        }

    return render(request, 'patients/metricas.html', {
        'paciente': paciente,
        'historial_antropometrico': historial,
        'diagnosticos_data': diagnosticos,
        'fecha_seleccionada': fecha_seleccionada,
        'fechas_disponibles': fechas_disponibles,
        'graficos_data': graficos_data,
        'section': 'metricas'
    })


def crear_grafico_evolucion(df, x_col, y_col, title):
    """Graficos de linea"""
    if y_col not in df.columns:
        return None

    # Filtrar datos válidos
    df_plot = df.dropna(subset=[x_col, y_col])
    if df_plot.empty:
        return None

    fig = px.line(
        df_plot,
        x=x_col,
        y=y_col,
        title=title,
        markers=True,
        labels={x_col: 'Fecha', y_col: title}
    )

    # Diseño
    fig.update_layout(
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)',
        xaxis=dict(
            showgrid=False,
            tickformat='%Y-%m-%d',
            # Ticks
            tickvals=df_plot[x_col].dt.strftime('%Y-%m-%d').unique().tolist(),
            ticktext=df_plot[x_col].dt.strftime('%Y-%m-%d').unique().tolist()
        ),
        yaxis=dict(showgrid=True, gridcolor='lightgray'),
        margin=dict(l=20, r=20, t=40, b=20),
        height=300
    )

    return pio.to_html(fig, full_html=False)

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
    
def get_diagnosticos_antropometricos(id_paciente, fecha):
    """
    Obtiene los diagnósticos antropométricos desde la API Node.js
    Args:
        id_paciente: ID del paciente
        fecha: Fecha en formato YYYY-MM-DD
    Returns:
        dict: Datos de diagnósticos o None si hay error
    """
    try:
        api_url = f'https://nutrilinkapi-production.up.railway.app/api_nutrilink/antropometria/obtener_calculos_y_diagnosticos_antropometria?pacienteId={id_paciente}&fecha={fecha}'
        response = requests.get(api_url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'success':
                return data['data']
        elif response.status_code == 404:
            return {}
        return None
    except requests.RequestException as e:
        print(f"Error al obtener diagnósticos antropométricos: {str(e)}")
        return None
    
# GET de la bd Alimentos   
def get_alimentos():
    url = 'https://nutrilinkapi-production.up.railway.app/api_nutrilink/alimento/alimentos'
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        alimentos = response.json()

        # Campos necesarios para el combobox
        alimentos_filtrados = []
        for a in alimentos:
            id_alimento = a.get('id_alimento')
            nombre = a.get('nombre_alimento')
            grupo = a.get('nombre_grupo_alimenticio', '')
            
            if id_alimento and nombre:
                alimentos_filtrados.append({
                    'id_alimento': id_alimento,
                    'nombre_alimento': nombre,
                    'nombre_grupo_alimenticio': grupo
                })

        return alimentos_filtrados
    except requests.RequestException as e:
        print(f"Error al obtener alimentos: {str(e)}")
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

# --- VISTA PARA ENVIAR MINUTA POR CORREO ---
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

@csrf_protect
@require_POST # Asegura que esta vista solo acepte POST
def enviar_minuta_por_correo(request, id_paciente):
    try:
        data = json.loads(request.body)
        minuta_html = data.get('minuta_html')

        if not minuta_html:
            return JsonResponse({'success': False, 'message': 'No se recibió contenido de la minuta.'}, status=400)

        # Obtener datos del paciente, incluido el nombre para el saludo
        paciente_info = get_paciente_data(id_paciente)
        if not paciente_info:
             return JsonResponse({'success': False, 'message': 'No se pudo obtener la información del paciente.'}, status=404)
        
        nombre_paciente = paciente_info.get('nombre_completo', 'Paciente')

        # Obtener correo usando get_credenciales
        credenciales = get_credenciales(id_paciente)
        if not credenciales or not credenciales.get('correo'):
            return JsonResponse({'success': False, 'message': 'No se pudo obtener el correo del paciente.'}, status=404)
        
        correo_paciente = credenciales['correo']

        asunto = f'Tu Plan de Alimentación de NutriLink - {nombre_paciente}'
        
        mensaje_html_completo = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; margin: 20px; color: #333; }}
                .minuta-container {{ border: 1px solid #ddd; padding: 15px; border-radius: 5px; background-color: #f9f9f9; }}
                h2, h3, h4, h5 {{ color: #0056b3; }}
                h3 {{ text-align: center; margin-bottom: 20px; }} /* Para el título general de la minuta */
                .minuta-tiempo-comida {{ margin-bottom: 20px; padding-bottom:10px; border-bottom: 1px solid #eee; }}
                .minuta-tiempo-comida:last-child {{ border-bottom: none; }}
                .hora-sugerida {{ font-style: italic; font-size: 0.9em; color: #555; }}
                .minuta-grupo-alimento {{ margin-left: 15px; margin-top:10px; }}
                .minuta-grupo-alimento pre {{ 
                    font-family: inherit; white-space: pre-wrap; margin: 5px 0; 
                    padding: 8px; border: 1px solid #ddd; background-color: #fff; 
                    border-radius: 3px; 
                }}
                .footer-email {{ margin-top: 25px; font-size: 0.9em; text-align: center; color: #777; }}
            </style>
        </head>
        <body>
            <p>Hola {nombre_paciente},</p>
            <p>Adjunto encontrarás tu plan de alimentación generado recientemente:</p>
            <div class="minuta-container">
                {minuta_html}
            </div>
            <p>Si tienes alguna duda, por favor contacta a tu nutricionista.</p>
            <p>¡Saludos!<br>Equipo NutriLink</p>
            <div class="footer-email">
                Este es un correo generado automáticamente. Por favor, no respondas directamente a este mensaje.
            </div>
        </body>
        </html>
        """
        
        texto_plano_minuta = minuta_html.replace('<br>', '\n').replace('<br/>', '\n')
        # Texto plano alternativo (muy básico)
        mensaje_texto_plano = f"""Hola {nombre_paciente},

        Aquí está tu plan de alimentación. Por favor, revisa el contenido HTML para una mejor visualización.

        {texto_plano_minuta}

        Saludos,
        Equipo NutriLink"""
        # Limpiar un poco más el HTML para texto plano sería ideal, pero esto es un inicio.

        email = EmailMultiAlternatives(
            subject=asunto,
            body=mensaje_texto_plano, # Contenido de texto plano
            from_email=settings.DEFAULT_FROM_EMAIL, # Asegúrate que DEFAULT_FROM_EMAIL esté en settings.py
            to=[correo_paciente]
        )
        email.attach_alternative(mensaje_html_completo, "text/html")
        email.send(fail_silently=False)

        return JsonResponse({
            'success': True,
            'message': f'Minuta enviada por correo exitosamente a {correo_paciente}.'
        })

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Error en el formato de los datos enviados.'}, status=400)
    except Exception as e:
        print(f"Error en enviar_minuta_por_correo: {str(e)}")
        return JsonResponse({'success': False, 'message': f'Ocurrió un error al enviar el correo: {str(e)}'}, status=500)
    


# ------------------------------------------------------------------------------------
# FUNCIONES PARA GRÁFICO DE ADECUACIÓN EN REGISTRO DIETARIO
# ------------------------------------------------------------------------------------

def obtener_datos_resumen_y_adecuacion_dieta_api(paciente_id, id_dieta=None):
    """
    Obtiene datos de resumen y adecuación desde la API de Node.js.
    Si id_dieta es None, obtiene el más reciente para el pacienteId.
    Si id_dieta está presente, obtiene el de ese registro específico.
    Devuelve el objeto 'data' de la API o None si hay error o no se encuentran datos.
    """
    try:
        if id_dieta:
            # Endpoint para un registro de dieta específico por su ID
            api_url = f'https://nutrilinkapi-production.up.railway.app/api_nutrilink/dieta/obtener_resumen_nutricional_por_id_dieta?pacienteId={paciente_id}&idDieta={id_dieta}'
        else:
            # Endpoint para el resumen más reciente del paciente
            api_url = f'https://nutrilinkapi-production.up.railway.app/api_nutrilink/dieta/obtener_resumen_nutricional?pacienteId={paciente_id}'
        
        print(f"DEBUG (VIEWS): Llamando API para resumen/adecuación: {api_url}")
        response = requests.get(api_url, timeout=10)
        
        if response.status_code == 404:
            print(f"DEBUG (VIEWS): API devolvió 404 para {api_url}")
            return None # No encontrado
        response.raise_for_status() # Lanza excepción para otros errores HTTP (500, etc.)
        
        api_response_data = response.json()
        
        if api_response_data.get("status") == "success" and api_response_data.get("data"):
            return api_response_data["data"]
        else:
            print(f"DEBUG (VIEWS): Respuesta no exitosa o sin datos de API para {api_url}. Respuesta: {api_response_data}")
            return None
            
    except requests.Timeout:
        print(f"Error (VIEWS): Timeout al conectar con API para resumen/adecuación: {api_url}")
        return None
    except requests.RequestException as e:
        print(f"Error (VIEWS): RequestException al obtener resumen/adecuación: {str(e)}. URL: {api_url}")
        return None
    except ValueError as e: # Error al parsear JSON
        print(f"Error (VIEWS): ValueError (JSON) al obtener resumen/adecuación: {str(e)}. URL: {api_url}")
        return None


def crear_grafico_barras_adecuacion(adecuacion_data, titulo="Porcentaje de Adecuación Nutricional"):
    """
    Crea un gráfico de barras horizontales para el porcentaje de adecuación.
    adecuacion_data: un diccionario como {'porc_adecuacion_calorico': 95.5, ...}
    """
    if not adecuacion_data or not isinstance(adecuacion_data, dict):
        print("DEBUG (VIEWS): crear_grafico_barras_adecuacion - no adecuacion_data o no es dict")
        return None

    nombres_nutrientes_map = {
        'porc_adecuacion_calorico': 'Energía (Kcal)',
        'porc_adec_proteinas': 'Proteínas (g)',
        'porc_adec_carbohidratos': 'Carbohidratos (g)',
        'porc_adec_lipidos': 'Lípidos (g)',
        'porc_adec_n3': 'Omega 3 (g)',
        'porc_adec_vita': 'Vitamina A (µg RE)',
        'porc_adec_b12': 'Vitamina B12 (µg)',
        'porc_adec_calcio': 'Calcio (mg)',
        'porc_adec_hierro': 'Hierro (mg)',
        'porc_adec_selenio': 'Selenio (µg)',
        'porc_adec_zinc': 'Zinc (mg)',
        'porc_adec_potasio': 'Potasio (mg)',
        'porc_adec_sodio': 'Sodio (mg)',
    }

    datos_grafico = []
    for key_api, nombre_amigable in nombres_nutrientes_map.items():
        if key_api in adecuacion_data and adecuacion_data[key_api] is not None:
            try:
                valor = float(adecuacion_data[key_api])
                datos_grafico.append({'Nutriente': nombre_amigable, '% Adecuación': valor})
            except (ValueError, TypeError):
                print(f"DEBUG (VIEWS): No se pudo convertir a float el valor para {key_api}: {adecuacion_data[key_api]}")
                pass
    
    if not datos_grafico:
        print("DEBUG (VIEWS): crear_grafico_barras_adecuacion - no datos_grafico para plotear")
        return None

    df_plot = pd.DataFrame(datos_grafico)
    # Asegurar que la columna Nutriente sea categórica para mantener el orden deseado si es necesario
    # df_plot['Nutriente'] = pd.Categorical(df_plot['Nutriente'], categories=[nombres_nutrientes_map[k] for k in nombres_nutrientes_map if k in adecuacion_data], ordered=True)
    df_plot = df_plot.sort_values(by='% Adecuación', ascending=True)


    fig = px.bar(
        df_plot,
        x='% Adecuación',
        y='Nutriente',
        orientation='h',
        title=titulo,
        text='% Adecuación',
        labels={'% Adecuación': '% de Adecuación (vs Requerimientos)'}
    )
    fig.update_traces(texttemplate='%{text:.1f}%', textposition='outside', marker_line_width=1.5, marker_line_color="black")

    fig.add_vline(x=100, line_width=2, line_dash="dash", line_color="darkgreen", annotation_text="100% Req.", annotation_position="top right")
    fig.add_vrect(x0=90, x1=110, fillcolor="lightgreen", opacity=0.2, layer="below", line_width=0, annotation_text="Rango Óptimo (90-110%)", annotation_position="bottom left")


    colors = []
    for val in df_plot['% Adecuación']:
        if val < 90: colors.append('rgba(255, 99, 132, 0.7)')  # Rojo claro para deficiencia
        elif val > 110: colors.append('rgba(255, 206, 86, 0.7)') # Amarillo claro para exceso
        else: colors.append('rgba(75, 192, 192, 0.7)') # Verde claro para adecuado
    fig.update_traces(marker_color=colors)

    max_x_val = df_plot['% Adecuación'].max() if not df_plot.empty else 120
    fig.update_layout(
        plot_bgcolor='rgba(250,250,250,1)', # Un fondo muy claro
        paper_bgcolor='rgba(0,0,0,0)',
        xaxis=dict(
            showgrid=True, 
            gridcolor='rgba(200,200,200,0.5)', 
            range=[0, max(120, max_x_val * 1.15)], # Rango dinámico con un mínimo
            title_standoff=15 
        ),
        yaxis=dict(showgrid=False, autorange="reversed", title_standoff=15), # reversed para que el de mayor valor esté arriba si se ordena desc
        margin=dict(l=160, r=30, t=60, b=30), # Ajustar márgenes
        height=max(350, len(df_plot) * 30 + 50), # Altura dinámica
        title_x=0.5, # Centrar título
        font=dict(family="Arial, sans-serif", size=11)
    )
    return pio.to_html(fig, full_html=False, include_plotlyjs=False) # No incluir Plotly.js si ya está en la página


# MODIFICACIÓN DE LA VISTA registroDietario
def registroDietario(request, id_paciente):
    try:
        paciente = get_paciente_data(id_paciente)
    except Http404:
        # Manejar el caso de paciente no encontrado elegantemente
        messages.error(request, "Paciente no encontrado.")
        return redirect('patients:gestion') # O a donde consideres apropiado

    # Obtener datos de adecuación para el registro más reciente para la carga inicial del gráfico
    # El JavaScript se encargará de llamar a la vista AJAX para actualizarlo
    datos_dieta_actual = obtener_datos_resumen_y_adecuacion_dieta_api(id_paciente) # Sin id_dieta para el más reciente
    
    grafico_adecuacion_html = None
    if datos_dieta_actual and 'adecuacion' in datos_dieta_actual:
        grafico_adecuacion_html = crear_grafico_barras_adecuacion(datos_dieta_actual['adecuacion'])
    else:
        print("DEBUG (VIEWS): No se obtuvieron datos de adecuación para el gráfico inicial.")

    return render(request, 'patients/registro-dietario.html', {
        'paciente': paciente,
        'grafico_adecuacion_html': grafico_adecuacion_html,
        'section': 'registro-dietario'
    })


# NUEVA VISTA AJAX PARA ACTUALIZAR EL GRÁFICO DE ADECUACIÓN
def grafico_adecuacion_dieta_ajax(request, id_paciente):
    if not request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return HttpResponse("Acceso no permitido.", status=403)

    id_dieta_str = request.GET.get('id_dieta')
    
    id_dieta = None
    if id_dieta_str:
        try:
            id_dieta = int(id_dieta_str)
        except ValueError:
            return HttpResponse("<p>ID de dieta inválido.</p>", status=400)

    # Obtener datos de adecuación
    datos_dieta = obtener_datos_resumen_y_adecuacion_dieta_api(id_paciente, id_dieta=id_dieta)
    
    if datos_dieta and 'adecuacion' in datos_dieta:
        grafico_generado = crear_grafico_barras_adecuacion(datos_dieta['adecuacion'])
        if grafico_generado:
            # Añadir un contenedor con clase para la transición
            html_grafico = f"""
            <div class="plotly-graph-container" style="opacity:0;">
                {grafico_generado}
            </div>
            <script>
                setTimeout(function() {{
                    document.querySelector('.plotly-graph-container').style.opacity = '1';
                }}, 50);
            </script>
            """
            return HttpResponse(html_grafico)
    
    return HttpResponse('<div class="plotly-graph-error"><p>No se pudieron cargar los datos para el gráfico.</p></div>')