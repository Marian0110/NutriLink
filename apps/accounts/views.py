import requests
from django.shortcuts import render, redirect
from django.contrib import messages
# Create your views here.

def registro(request):
    if request.method == 'POST':
        # Traer datos del formulario
        rut_completo = request.POST.get('rut', '').replace('.', '').replace('-', '')
        rut_numerico = rut_completo[:-1]
        dv = rut_completo[-1].upper()
        
        data = {
            "rut_nutricionista": rut_numerico,
            "dv": dv,
            "primer_nombre": request.POST.get('primerNombre'),
            "apellido_paterno": request.POST.get('apellidoP'),
            "correo": request.POST.get('email'),
            "contrasena": request.POST.get('contraseña'),
            # Campos opcionales explicitamente como None si son vacios
            "segundo_nombre": None,
            "apellido_materno": None,
            "fecha_nacimiento": None,
            "foto": None,
            "telefono": None
        }

        try:
            response = requests.post(
                "https://nutrilinkapi-production.up.railway.app/api_nutrilink/nutricionista/registrar",
                json=data,
                timeout=4
            )

            if response.status_code == 201:
                messages.success(request, '¡Registro exitoso!')
                return redirect('accounts:perfil')
            else:
                error_msg = response.json().get('error', 'Error desconocido')
                messages.error(request, f'Error: {error_msg}')
                
        except requests.exceptions.RequestException as e:
            messages.error(request, 'Error al conectar con el servidor')

    return render(request, 'accounts/registro.html')


def perfil(request):
    url = 'https://nutrilinkapi-production.up.railway.app/api_nutrilink/nutricionista/especialidades'
    especialidades = []

    try:
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            especialidades = data

    except requests.exceptions.RequestException as e:
        print("Error:", e)

    context = {
        'especialidades': especialidades, 
    }
    return render(request, 'accounts/perfil.html', context)

def login(request):
    return render(request, 'accounts/login.html')

def dashboard(request):
    return render(request, 'accounts/dashboard.html')