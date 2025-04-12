from django.shortcuts import render

# Create your views here.

def registro(request):
    return render(request, 'accounts/registro.html')

def login(request):
    return render(request, 'accounts/login.html')

def perfil(request):
    return render(request, 'accounts/perfil.html')

def redirectPerfil(request):
    return render(request, 'accounts/perfil.html') #por el momento

# def registro(request):
#     if request.method == 'POST':
#         # En el futuro manejo de usuario
#         return redirect('perfil')
#     return render(request, 'accounts/registro.html')