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

    try:
        # 1. Obtener todos los alimentos
        response_alimentos = requests.get(api_url_alimentos)
        response_alimentos.raise_for_status()
        alimentos_raw = response_alimentos.json()

        # Recolectar los nombres de grupos únicos para el filtro de la página principal
        if alimentos_raw:
            grupos_para_filtro_nombres = sorted(list(set(
                item.get('nombre_grupo_alimenticio', '') 
                for item in alimentos_raw if item.get('nombre_grupo_alimenticio')
            )))

        # 2. Obtener la lista de grupos alimenticios con ID para el modal
        response_grupos = requests.get(api_url_grupos)
        response_grupos.raise_for_status()
        grupos_data_api = response_grupos.json()
        
        if grupos_data_api:
            grupos_para_modal_con_id = sorted(grupos_data_api, key=lambda x: x['descripcion'])


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
        paginator = Paginator(alimentos_filtrados, 5)
        page_number = request.GET.get('page')
        try:
            page_obj = paginator.page(page_number)
        except PageNotAnInteger:
            page_obj = paginator.page(1)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages)

    except requests.exceptions.RequestException as e:
        print(f"Error al conectar con la API: {e}")

    context = {
        'page_obj': page_obj, 
        'grupos_filtro': grupos_para_filtro_nombres, 
        'grupos_modal': grupos_para_modal_con_id,  
        'request_get_q': request.GET.get('q', ''), 
        'request_get_grupo': request.GET.get('grupo', '') 
    }
    return render(request, 'foods/bdCrud.html', context)