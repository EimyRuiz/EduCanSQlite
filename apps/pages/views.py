from django.shortcuts import render
from apps.training.models import Servicio
from apps.shop.models import Producto


def home(request):
    servicios = Servicio.objects.all()[:4]
    productos = Producto.objects.all()[:3]
    return render(request, 'pages/home.html', {
        'servicios': servicios,
        'productos': productos,
    })


def services(request):
    servicios = Servicio.objects.all()
    return render(request, 'pages/services.html', {'servicios': servicios})


def shop(request):
    productos = Producto.objects.all()
    return render(request, 'pages/shop.html', {'productos': productos})


def request_service(request):
    return render(request, 'pages/request_service.html')


def admin_panel(request):
    return render(request, 'pages/admin_panel.html')


def trainer_panel(request):
    return render(request, 'pages/trainer_panel.html')


def my_profile(request):
    return render(request, 'pages/my_profile.html')