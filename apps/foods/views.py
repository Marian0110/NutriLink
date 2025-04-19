from django.shortcuts import render
import requests
from django.http import JsonResponse

# Create your views here.

from django.shortcuts import render
import requests

def bdCrud(request):
    url = 'https://nutrilinkapi-production.up.railway.app/api_nutrilink/mantenedor_alimentos/alimentos'
    alimentos = []
    grupos = set()

    try:
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            alimentos = data

            # Recolectar los grupos únicos
            grupos = sorted(set(item.get('nombre_grupo_alimenticio', '') for item in data if item.get('nombre_grupo_alimenticio')))
            # Filtros
            query = request.GET.get('q', '').lower()
            grupo_filtro = request.GET.get('grupo', '')

            if query:
                alimentos = [a for a in alimentos if query in a.get('nombre_alimento', '').lower()]
            if grupo_filtro:
                alimentos = [a for a in alimentos if a.get('nombre_grupo_alimenticio') == grupo_filtro]
                

    except requests.exceptions.RequestException as e:
        print("Error:", e)

    context = {
        'alimentos': alimentos,
        'grupos': grupos
    }
    return render(request, 'foods/bdCrud.html', context)


