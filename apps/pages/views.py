from django.db.models import Avg
from django.shortcuts import render

from apps.training.models import Servicio
from apps.shop.models import Producto
from apps.users.models import Usuario
from apps.requests.models import Solicitud
from apps.reviews.models import Resena
from .models import Mensaje


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
            'inicial': (r.cliente.nombre or '?')[:1].upper(),            # para el círculo si no hay foto
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


def about(request):
    """Nosotros: todos los números salen de la base de datos (nada inventado)."""
    resenas = Resena.objects.all()
    promedio = resenas.aggregate(p=Avg('estrellas'))['p']
    equipo = Usuario.objects.filter(rol='adiestrador', estado_aprobacion='aprobado').order_by('nombre')[:8]

    return render(request, 'pages/about.html', {
        'clientes': Usuario.objects.filter(rol='cliente').count(),
        'servicios_completados': Solicitud.objects.filter(estado='completado').count(),
        'adiestradores': Usuario.objects.filter(rol='adiestrador', estado_aprobacion='aprobado').count(),
        'promedio': f"{promedio:.1f}".replace('.', ',') if promedio else '',   # "4,8" o vacío si no hay reseñas
        'total_resenas': resenas.count(),
        'equipo': equipo,
    })


def contact(request):
    return render(request, 'pages/contact.html', {'motivos': Mensaje.MOTIVOS})


# Texto de apoyo de cada programa en la página Servicios (categoría, "ideal para", puntos y comparativa).
# La clave es el NOMBRE del servicio tal como está en la base de datos. Si creas un servicio nuevo
# que no está aquí, la página usa el texto "general" de más abajo y no se rompe.
CATEGORIAS = [
    ('primeros', 'Primeros aprendizajes'),
    ('habitos', 'Hábitos cotidianos'),
    ('avanzado', 'Comportamiento avanzado'),
]

PROGRAMAS_INFO = {
    'Adiestramiento básico': {
        'categoria': 'habitos',
        'ideal': 'Para perros que necesitan aprender las bases.',
        'puntos': ['Atención y señales básicas', 'Paseos y manejo de la correa', 'Autocontrol en el día a día'],
        'partida': 'Quiero mejorar los hábitos de mi perro.',
        'foco': 'Comunicación, atención y convivencia.',
        'cotidiano': 'Practicar señales y pasear con más calma.',
    },
    'Cachorros y socialización': {
        'categoria': 'primeros',
        'ideal': 'Para familias que comienzan con un cachorro.',
        'puntos': ['Rutinas e higiene en casa', 'Juego y manejo de la mordida', 'Exploración y socialización gradual'],
        'partida': 'Mi cachorro está descubriendo el mundo.',
        'foco': 'Prevención, rutinas y experiencias positivas.',
        'cotidiano': 'Acompañar sus primeras experiencias.',
    },
    'Modificación de conducta': {
        'categoria': 'avanzado',
        'ideal': 'Para dificultades que afectan la convivencia.',
        'puntos': ['Comprensión de sus emociones', 'Manejo de situaciones difíciles', 'Pautas adaptadas a su entorno'],
        'partida': 'Una conducta nos está generando dificultades.',
        'foco': 'Emociones, contexto y pautas de manejo.',
        'cotidiano': 'Abordar situaciones que le cuestan.',
    },
    'Ansiedad por separación': {
        'categoria': 'avanzado',
        'ideal': 'Para perros que sufren cuando se quedan solos.',
        'puntos': ['Rutinas de salida y de llegada', 'Calma al quedarse solo', 'Pautas graduales en casa'],
        'partida': 'Mi perro sufre cuando me ausento.',
        'foco': 'Seguridad emocional y rutinas.',
        'cotidiano': 'Dejarlo solo con más tranquilidad.',
    },
}

PROGRAMA_GENERAL = {
    'categoria': 'habitos',
    'ideal': 'Para perros y familias que quieren mejorar su convivencia.',
    'puntos': ['Plan adaptado a tu perro', 'Pautas para practicar en casa', 'Acompañamiento de un adiestrador'],
    'partida': 'Quiero acompañar mejor a mi perro.',
    'foco': 'Convivencia y bienestar.',
    'cotidiano': 'Aplicar lo aprendido en el día a día.',
}


def services(request):
    nombres_categoria = dict(CATEGORIAS)
    programas = []
    for s in Servicio.objects.all():
        info = PROGRAMAS_INFO.get(s.nombre, PROGRAMA_GENERAL)
        programas.append({
            'id': s.id,
            'nombre': s.nombre,
            'descripcion': s.descripcion,
            'precio': s.precio,
            'imagen': s.imagen,
            'categoria': info['categoria'],
            'categoria_texto': nombres_categoria[info['categoria']],
            'ideal': info['ideal'],
            'puntos': info['puntos'],
            'partida': info['partida'],
            'foco': info['foco'],
            'cotidiano': info['cotidiano'],
        })
    return render(request, 'pages/services.html', {
        'programas': programas,
        'total': len(programas),
        'categorias': CATEGORIAS,
    })


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
    'Blog': 'Artículos semanales, guías de conducta y recomendaciones de salud para tu mascota.',
    'Términos de Servicio': 'Las condiciones de uso de la plataforma EDUCAN.',
    'Política de Privacidad': 'Cómo cuidamos y protegemos tus datos personales.',
}

def maintenance(request, section):
    return render(request, 'pages/maintenance.html', {
        'section': section,
        'lead': MAINTENANCE_PAGES.get(section, ''),
    })

def blog(request):
    """Blog de la comunidad. Todo el contenido se carga por JavaScript desde /api/community/."""
    return render(request, 'pages/blog.html')