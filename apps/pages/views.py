from django.shortcuts import render
from apps.training.models import Servicio
from apps.shop.models import Producto
from apps.users.models import Usuario
from apps.requests.models import Solicitud
from apps.reviews.models import Resena


def home(request):
    servicios = Servicio.objects.all()[:4]
    productos = Producto.objects.all()[:3]

    # ---- Estadísticas reales ----
    perros_entrenados = Solicitud.objects.filter(estado='completado').count()
    adiestradores = Usuario.objects.filter(rol='adiestrador', estado_aprobacion='aprobado').count()

    resenas = Resena.objects.select_related('cliente', 'solicitud', 'respondido_por')
    total_resenas = resenas.count()
    buenas = resenas.filter(estrellas__gte=4).count()
    satisfaccion = round((buenas / total_resenas) * 100) if total_resenas else 0

    # ---- Testimonios: las 3 reseñas más recientes de 4 o 5 estrellas con comentario ----
    testimonios = []
    destacadas = resenas.filter(estrellas__gte=4).exclude(comentario='').order_by('-creado_en')[:3]
    for r in destacadas:
        autor = r.respondido_por
        respondio_adiestrador = bool(autor and autor.rol == 'adiestrador')
        testimonios.append({
            'nombre': f"{r.cliente.nombre} {r.cliente.apellido[:1]}.",   # "María T." (privacidad)
            'foto': r.cliente.foto,
            'servicio': r.solicitud.servicio,
            'comentario': r.comentario,
            'respuesta': r.respuesta_admin,
            # Quién respondió: el adiestrador (nombre + insignia) o EDUCAN (administrador)
            'respuesta_por': f"{autor.nombre} {autor.apellido[:1]}." if respondio_adiestrador else 'EDUCAN',
            'respuesta_rol': 'Adiestrador' if respondio_adiestrador else 'Administrador',
            'llenas': list(range(r.estrellas)),
            'vacias': list(range(5 - r.estrellas)),
        })

    return render(request, 'pages/home.html', {
        'servicios': servicios,
        'productos': productos,
        'perros_entrenados': perros_entrenados,
        'adiestradores': adiestradores,
        'satisfaccion': satisfaccion,
        'testimonios': testimonios,
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


# Textos de las secciones que aún no existen. Cada una usa la misma plantilla pages/maintenance.html.
MAINTENANCE_PAGES = {
    'Nosotros': 'Conoce al equipo y la historia detrás de EDUCAN.',
    'Blog': 'Artículos semanales, guías de conducta y recomendaciones de salud para tu mascota.',
    'Contacto': 'Escríbenos y resolvemos tus dudas sobre nuestros servicios.',
    'Términos de Servicio': 'Las condiciones de uso de la plataforma EDUCAN.',
    'Política de Privacidad': 'Cómo cuidamos y protegemos tus datos personales.',
}

def maintenance(request, section):
    return render(request, 'pages/maintenance.html', {
        'section': section,
        'lead': MAINTENANCE_PAGES.get(section, ''),
    })