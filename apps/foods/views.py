from django.shortcuts import render

# Create your views here.

def bdCrud(request):
    return render(request, 'foods/bdCrud.html')