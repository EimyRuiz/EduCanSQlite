"""
apps/community/restrictions.py
Todo lo de cuentas suspendidas/desactivadas:
  - revisar si un usuario está restringido
  - aplicar una suspensión automática (filtro de palabras) o una desactivación (administrador)
  - un "middleware" que bloquea a los usuarios restringidos en TODA la API, aunque su token siga vigente
"""
import json
from datetime import timedelta

from django.http import JsonResponse
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken

from apps.users.models import Usuario
from .models import Restriccion, Publicacion, Comentario

DIAS_PRIMERA_VEZ = 3
DIAS_REINCIDENTE = 7

MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
         'septiembre', 'octubre', 'noviembre', 'diciembre']


def fecha_texto(fecha):
    """31 de octubre de 2026 (en la hora local del servidor)."""
    if timezone.is_aware(fecha):
        fecha = timezone.localtime(fecha)
    return f"{fecha.day} de {MESES[fecha.month - 1]} de {fecha.year}"


def restriccion_activa(usuario_id):
    """Devuelve la restricción vigente del usuario o None. Si ya venció, la borra."""
    r = Restriccion.objects.filter(usuario_id=usuario_id).first()
    if not r:
        return None
    if r.activa:
        return r
    r.delete()
    return None


def mensaje_restriccion(r):
    if r.hasta is None:
        return 'Tu cuenta fue desactivada por la administración de EDUCAN. Escríbenos desde Contacto si crees que es un error.'
    return f'Tu cuenta está suspendida hasta el {fecha_texto(r.hasta)} por incumplir las normas de vocabulario de la comunidad.'


def sancionar_por_vocabulario(usuario, origen):
    """
    Suspende la cuenta: 3 días la primera vez y 7 días si ya tenía otro contenido bloqueado o rechazado.
    'origen' dice qué comentario o publicación la causó, por ejemplo "comentario:12".
    """
    previos = (Comentario.objects.filter(autor=usuario, estado__in=['bloqueado', 'rechazado']).count()
               + Publicacion.objects.filter(autor=usuario, estado__in=['bloqueado', 'rechazado']).count())
    dias = DIAS_PRIMERA_VEZ if previos <= 1 else DIAS_REINCIDENTE     # "previos" ya incluye el contenido recién guardado
    restriccion, _ = Restriccion.objects.update_or_create(
        usuario=usuario,
        defaults={
            'hasta': timezone.now() + timedelta(days=dias),
            'motivo': 'Vocabulario inapropiado en la comunidad',
            'origen': origen,
        },
    )
    return restriccion


def desactivar_cuenta(usuario):
    r, _ = Restriccion.objects.update_or_create(
        usuario=usuario,
        defaults={'hasta': None, 'motivo': 'Cuenta desactivada por la administración', 'origen': 'admin'},
    )
    return r


class RestriccionMiddleware:
    """
    El token de inicio de sesión sigue siendo válido aunque suspendas a alguien (dura 1 hora),
    así que esta pieza revisa CADA petición a /api/ y la rechaza si la cuenta está restringida.
    También impide iniciar sesión mientras dure la suspensión.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/api/'):
            respuesta = self._revisar(request)
            if respuesta:
                return respuesta
        return self.get_response(request)

    def _revisar(self, request):
        try:
            # 1) Intento de iniciar sesión
            if request.path.rstrip('/') == '/api/users/login' and request.method == 'POST':
                datos = json.loads(request.body or b'{}')
                email = str(datos.get('email', '')).strip()
                usuario = Usuario.objects.filter(email=email).first()
                if usuario and usuario.rol != 'administrador':
                    r = restriccion_activa(usuario.id)
                    if r:
                        return JsonResponse({'error': mensaje_restriccion(r), 'cuenta_suspendida': True}, status=403)
                return None

            # 2) Petición con sesión iniciada
            cabecera = request.META.get('HTTP_AUTHORIZATION', '')
            if not cabecera.startswith('Bearer '):
                return None
            token = AccessToken(cabecera[7:])
            if token.get('rol') == 'administrador':
                return None
            r = restriccion_activa(token.get('user_id'))
            if r:
                return JsonResponse({'error': mensaje_restriccion(r), 'cuenta_suspendida': True}, status=401)
        except Exception:
            # Token inválido, cuerpo que no es JSON, etc.: se deja pasar y lo resuelve la vista normal
            return None
        return None