from django.shortcuts import render
import requests
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger

def bdCrud(request):
    url = 'https://nutrilinkapi-production.up.railway.app/api_nutrilink/alimento/alimentos'
    alimentos = []
    grupos = set()

    try:
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            alimentos = data

            # Recolectar los grupos uniques
            grupos = sorted(set(item.get('nombre_grupo_alimenticio', '') for item in data if item.get('nombre_grupo_alimenticio')))
            # Filtros
            query = request.GET.get('q', '').lower()
            grupo_filtro = request.GET.get('grupo', '')

            if query:
                alimentos = [a for a in alimentos if query in a.get('nombre_alimento', '').lower()]
            if grupo_filtro:
                alimentos = [a for a in alimentos if a.get('nombre_grupo_alimenticio') == grupo_filtro]

            # Paginacion - 5 elementos por pg
            paginator = Paginator(alimentos, 5)
            page_number = request.GET.get('page')
            try:
                page_obj = paginator.page(page_number)
            except PageNotAnInteger:
                page_obj = paginator.page(1)
            except EmptyPage:
                page_obj = paginator.page(paginator.num_pages)

    except requests.exceptions.RequestException as e:
        print("Error:", e)
        page_obj = None

    context = {
        'alimentos': alimentos, 
        'page_obj': page_obj, #obj de paginacion
        'grupos': grupos
    }
    return render(request, 'foods/bdCrud.html', context)