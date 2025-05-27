from django.shortcuts import render
import requests
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger

def bdCrud(request):
    api_url_alimentos = 'https://nutrilinkapi-production.up.railway.app/api_nutrilink/alimento/alimentos'
    api_url_grupos = 'https://nutrilinkapi-production.up.railway.app/api_nutrilink/alimento/obtener_grupos_alimenticios_con_id'
    
    alimentos_raw = []
    page_obj = None
    grupos_para_filtro_nombres = set() 
    grupos_para_modal_con_id = []   
    error_message = None # Para mensajes de error en la plantilla

    try:
        # 1. Obtener la lista de grupos alimenticios con ID para el modal Y para mapeo
        response_grupos = requests.get(api_url_grupos)
        response_grupos.raise_for_status()
        grupos_data_api = response_grupos.json()
        
        if grupos_data_api:
            grupos_para_modal_con_id = sorted(grupos_data_api, key=lambda x: x['descripcion'])
            # Crear un mapa de nombre_grupo -> id_grupo para una búsqueda eficiente
            grupo_nombre_a_id_map = {
                g['descripcion']: g['id_grupo_alimenticio'] for g in grupos_data_api
            }
        else:
            grupo_nombre_a_id_map = {}
            error_message = "No se pudieron cargar los grupos alimenticios desde la API."

        # 2. Obtener todos los alimentos
        response_alimentos = requests.get(api_url_alimentos)
        response_alimentos.raise_for_status()
        alimentos_raw = response_alimentos.json()

        # Enriquecer cada alimento con su id_grupo_alimenticio
        if alimentos_raw:
            for alimento_item in alimentos_raw:
                nombre_grupo = alimento_item.get('nombre_grupo_alimenticio')
                if nombre_grupo and nombre_grupo in grupo_nombre_a_id_map:
                    alimento_item['id_grupo_alimenticio'] = grupo_nombre_a_id_map[nombre_grupo]
                else:
                    # Si el grupo no se encuentra en el mapa, o no tiene nombre de grupo,
                    # se le asigna None. El template lo manejará.
                    alimento_item['id_grupo_alimenticio'] = None
            
            # Recolectar los nombres de grupos únicos para el filtro de la página principal
            # Esto es mejor hacerlo DESPUÉS de enriquecer, por si acaso, aunque aquí no cambia mucho
            grupos_para_filtro_nombres = sorted(list(set(
                item.get('nombre_grupo_alimenticio', '') 
                for item in alimentos_raw if item.get('nombre_grupo_alimenticio')
            )))


        # Aplicar filtros a los alimentos
        alimentos_filtrados = alimentos_raw[:] 
        query = request.GET.get('q', '').lower()
        grupo_filtro_seleccionado = request.GET.get('grupo', '')

        if query:
            alimentos_filtrados = [
                a for a in alimentos_filtrados if query in a.get('nombre_alimento', '').lower()
            ]
        if grupo_filtro_seleccionado:
            alimentos_filtrados = [
                a for a in alimentos_filtrados if a.get('nombre_grupo_alimenticio') == grupo_filtro_seleccionado
            ]

        # Paginación
        paginator = Paginator(alimentos_filtrados, 5) # Cambiado a 5 para el ejemplo
        page_number = request.GET.get('page')
        try:
            page_obj = paginator.page(page_number)
        except PageNotAnInteger:
            page_obj = paginator.page(1)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages)

    except requests.exceptions.RequestException as e:
        print(f"Error al conectar con la API: {e}")
        error_message = f"Error al conectar con la API: {e}. Por favor, intente más tarde."
        page_obj = None 
        alimentos_filtrados = [] 

    context = {
        'page_obj': page_obj, 
        'grupos_filtro': grupos_para_filtro_nombres, 
        'grupos_modal': grupos_para_modal_con_id,  
        'request_get_q': request.GET.get('q', ''), 
        'request_get_grupo': request.GET.get('grupo', ''),
        'error_message': error_message 
    }
    return render(request, 'foods/bdCrud.html', context)