"""
apps/community/views.py
API del blog de la comunidad.

Públicas (cualquier visitante puede VER):
  GET  /api/community/me/                      qué puede hacer quien está mirando
  GET  /api/community/posts/                   lista de publicaciones (?pagina=2, ?siguiendo=1)
  GET  /api/community/posts/<id>/comments/     comentarios de una publicación

Con cuenta (y sin suspensión):
  POST   /api/community/posts/                 publicar (solo clientes con un servicio completado)
  DELETE /api/community/posts/<id>/            borrar la propia (el administrador puede borrar cualquiera)
  POST   /api/community/posts/<id>/like/       dar / quitar "me gusta"
  POST   /api/community/posts/<id>/comments/   comentar
  DELETE /api/community/comments/<id>/         borrar el propio comentario
  POST   /api/community/users/<id>/follow/     seguir / dejar de seguir

Solo administrador:
  GET  /api/community/moderation/                  todo lo que hay por revisar
  GET  /api/community/moderation/resumen/          solo el número de pendientes (para el aviso del menú)
  POST /api/community/moderation/comments/<id>/    {accion: restaurar | eliminar}
  POST /api/community/moderation/posts/<id>/       {accion: restaurar | eliminar}
  POST /api/community/moderation/users/<id>/       {accion: desactivar | reactivar}
"""
from datetime import timedelta

from django.db.models import Count
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.authentication import IsMongoAuthenticated, IsAdminRole
from apps.core.media_files import guardar_imagen, borrar_archivo
from apps.requests.models import Solicitud
from apps.users.models import Usuario
from .models import Publicacion, Comentario, Like, Seguimiento, Restriccion
from .restrictions import (
    restriccion_activa, mensaje_restriccion, sancionar_por_vocabulario, desactivar_cuenta,
)
from .words import revisar_texto

POR_PAGINA = 10
MAX_PUBLICACIONES_POR_HORA = 5
MAX_COMENTARIOS_POR_HORA = 20


# ----------------------------------------------------------------------------
# Utilidades
# ----------------------------------------------------------------------------
def _dato_token(request, clave):
    """Lee un dato del token (user_id, rol). Si el visitante no inició sesión devuelve None."""
    leer = getattr(request.user, 'get', None)
    return leer(clave) if leer else None


def _usuario_actual(request):
    uid = _dato_token(request, 'user_id')
    return Usuario.objects.filter(id=uid).first() if uid else None


def _verificar(request):
    """
    Devuelve (usuario, None) si puede participar, o (None, respuesta_de_error).
    Se revisa en cada acción porque el token sigue vigente aunque la cuenta se suspenda.
    """
    usuario = _usuario_actual(request)
    if not usuario:
        return None, Response({'error': 'Inicia sesión para participar en la comunidad.'},
                              status=status.HTTP_401_UNAUTHORIZED)
    if usuario.rol != 'administrador':
        r = restriccion_activa(usuario.id)
        if r:
            return None, Response({'error': mensaje_restriccion(r), 'cuenta_suspendida': True},
                                  status=status.HTTP_403_FORBIDDEN)
    return usuario, None


def _nombre_publico(u):
    """"María T." (el apellido completo no se muestra, por privacidad)."""
    return f"{u.nombre} {u.apellido[:1]}.".strip()


def _autor(u):
    return {'id': u.id, 'nombre': _nombre_publico(u), 'inicial': (u.nombre or '?')[:1].upper(),
            'foto': u.foto or '', 'rol': u.rol}


def _puede_publicar(usuario):
    """(puede, razón). Solo clientes con al menos un servicio completado; el administrador también."""
    if usuario.rol == 'administrador':
        return True, ''
    if usuario.rol != 'cliente':
        return False, 'Por ahora solo los clientes que completaron un servicio pueden publicar.'
    if not Solicitud.objects.filter(cliente_id=usuario.id, estado='completado').exists():
        return False, 'Podrás publicar tus fotos cuando termines uno de nuestros servicios.'
    return True, ''


def _texto_valido(texto, minimo, maximo):
    """Devuelve el mensaje de error o None si el texto está bien."""
    if len(texto) < minimo:
        return f'Escribe al menos {minimo} caracteres.'
    if len(texto) > maximo:
        return f'El texto no puede pasar de {maximo} caracteres.'
    if '<' in texto or '>' in texto:
        return 'No uses los símbolos < o > en el texto.'
    return None


def _bloqueo_por_vocabulario(usuario, objeto, origen, palabra):
    """Respuesta que se devuelve cuando el filtro de palabras detiene un contenido."""
    r = sancionar_por_vocabulario(usuario, f'{origen}:{objeto.id}')
    return Response({
        'error': 'Tu mensaje no se publicó porque contiene lenguaje inapropiado. ' + mensaje_restriccion(r),
        'bloqueado': True,
        'cuenta_suspendida': True,
    }, status=status.HTTP_403_FORBIDDEN)


def _serializar_publicaciones(posts, uid):
    ids = [p.id for p in posts]
    autores = [p.autor_id for p in posts]
    likes = dict(Like.objects.filter(publicacion_id__in=ids).order_by()
                 .values('publicacion_id').annotate(n=Count('id')).values_list('publicacion_id', 'n'))
    coms = dict(Comentario.objects.filter(publicacion_id__in=ids, estado='publicado').order_by()
                .values('publicacion_id').annotate(n=Count('id')).values_list('publicacion_id', 'n'))
    mis_likes = set(Like.objects.filter(publicacion_id__in=ids, usuario_id=uid)
                    .values_list('publicacion_id', flat=True)) if uid else set()
    siguiendo = set(Seguimiento.objects.filter(seguidor_id=uid, seguido_id__in=autores)
                    .values_list('seguido_id', flat=True)) if uid else set()
    return [{
        'id': p.id,
        'autor': _autor(p.autor),
        'texto': p.texto,
        'imagen': p.imagen,
        'creado_en': p.creado_en.isoformat(),
        'likes': likes.get(p.id, 0),
        'me_gusta': p.id in mis_likes,
        'comentarios': coms.get(p.id, 0),
        'siguiendo': p.autor_id in siguiendo,
        'es_mio': bool(uid) and str(p.autor_id) == str(uid),
    } for p in posts]


def _serializar_comentario(c, uid):
    return {
        'id': c.id,
        'autor': _autor(c.autor),
        'texto': c.texto,
        'creado_en': c.creado_en.isoformat(),
        'es_mio': bool(uid) and str(c.autor_id) == str(uid),
    }


# ----------------------------------------------------------------------------
# Quién soy y qué puedo hacer
# ----------------------------------------------------------------------------
class MeView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        usuario = _usuario_actual(request)
        if not usuario:
            return Response({'autenticado': False, 'puede_publicar': False,
                             'razon': 'Inicia sesión para participar en la comunidad.'})
        if usuario.rol != 'administrador':
            r = restriccion_activa(usuario.id)
            if r:
                return Response({'autenticado': True, 'rol': usuario.rol, 'puede_publicar': False,
                                 'suspendida': True, 'razon': mensaje_restriccion(r)})
        puede, razon = _puede_publicar(usuario)
        return Response({'autenticado': True, 'id': usuario.id, 'rol': usuario.rol,
                         'puede_publicar': puede, 'razon': razon, 'suspendida': False})


# ----------------------------------------------------------------------------
# Publicaciones
# ----------------------------------------------------------------------------
class PublicacionListCreateView(APIView):
    def get_permissions(self):
        return [AllowAny()] if self.request.method == 'GET' else [IsMongoAuthenticated()]

    def get(self, request):
        uid = _dato_token(request, 'user_id')
        consulta = Publicacion.objects.filter(estado='publicado').select_related('autor').order_by('-creado_en')

        if request.query_params.get('siguiendo') == '1':
            if not uid:
                return Response({'error': 'Inicia sesión para ver a quién sigues.'}, status=status.HTTP_401_UNAUTHORIZED)
            consulta = consulta.filter(autor_id__in=Seguimiento.objects.filter(seguidor_id=uid).values('seguido_id'))

        try:
            pagina = max(int(request.query_params.get('pagina', 1)), 1)
        except ValueError:
            pagina = 1
        inicio = (pagina - 1) * POR_PAGINA
        bloque = list(consulta[inicio:inicio + POR_PAGINA + 1])      # uno de más para saber si hay otra página
        return Response({
            'resultados': _serializar_publicaciones(bloque[:POR_PAGINA], uid),
            'hay_mas': len(bloque) > POR_PAGINA,
        })

    def post(self, request):
        usuario, error = _verificar(request)
        if error:
            return error
        puede, razon = _puede_publicar(usuario)
        if not puede:
            return Response({'error': razon}, status=status.HTTP_403_FORBIDDEN)

        reciente = timezone.now() - timedelta(hours=1)
        if Publicacion.objects.filter(autor=usuario, creado_en__gte=reciente).count() >= MAX_PUBLICACIONES_POR_HORA:
            return Response({'error': 'Has publicado muchas veces seguidas. Intenta de nuevo en un rato.'},
                            status=status.HTTP_429_TOO_MANY_REQUESTS)

        texto = str(request.data.get('texto', '')).strip()
        problema = _texto_valido(texto, 5, 1000)
        if problema:
            return Response({'error': problema}, status=status.HTTP_400_BAD_REQUEST)

        # Filtro de vocabulario (el administrador no se filtra)
        if usuario.rol != 'administrador':
            palabra = revisar_texto(texto)
            if palabra:
                publicacion = Publicacion.objects.create(autor=usuario, texto=texto, estado='bloqueado',
                                                         palabra_detectada=palabra)
                return _bloqueo_por_vocabulario(usuario, publicacion, 'publicacion', palabra)

        ruta = ''
        archivo = request.FILES.get('imagen')
        if archivo:
            try:
                ruta = guardar_imagen(archivo, 'comunidad', prefijo=f"{usuario.id}_")
            except ValueError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        publicacion = Publicacion.objects.create(autor=usuario, texto=texto, imagen=ruta)
        return Response(_serializar_publicaciones([publicacion], usuario.id)[0], status=status.HTTP_201_CREATED)


class PublicacionDetailView(APIView):
    permission_classes = [IsMongoAuthenticated]

    def delete(self, request, pk):
        usuario, error = _verificar(request)
        if error:
            return error
        publicacion = Publicacion.objects.filter(id=pk).first()
        if not publicacion:
            return Response({'error': 'No encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        if publicacion.autor_id != usuario.id and usuario.rol != 'administrador':
            return Response({'error': 'No puedes borrar la publicación de otra persona.'},
                            status=status.HTTP_403_FORBIDDEN)
        borrar_archivo(publicacion.imagen)
        publicacion.delete()
        return Response({'mensaje': 'Publicación eliminada.'})


class LikeView(APIView):
    permission_classes = [IsMongoAuthenticated]

    def post(self, request, pk):
        usuario, error = _verificar(request)
        if error:
            return error
        publicacion = Publicacion.objects.filter(id=pk, estado='publicado').first()
        if not publicacion:
            return Response({'error': 'No encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        like = Like.objects.filter(publicacion=publicacion, usuario=usuario).first()
        if like:
            like.delete()
            me_gusta = False
        else:
            Like.objects.create(publicacion=publicacion, usuario=usuario)
            me_gusta = True
        return Response({'me_gusta': me_gusta, 'likes': Like.objects.filter(publicacion=publicacion).count()})


# ----------------------------------------------------------------------------
# Comentarios
# ----------------------------------------------------------------------------
class ComentarioListCreateView(APIView):
    def get_permissions(self):
        return [AllowAny()] if self.request.method == 'GET' else [IsMongoAuthenticated()]

    def get(self, request, pk):
        uid = _dato_token(request, 'user_id')
        if not Publicacion.objects.filter(id=pk, estado='publicado').exists():
            return Response({'error': 'No encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        comentarios = Comentario.objects.filter(publicacion_id=pk, estado='publicado').select_related('autor')
        return Response([_serializar_comentario(c, uid) for c in comentarios])

    def post(self, request, pk):
        usuario, error = _verificar(request)
        if error:
            return error
        publicacion = Publicacion.objects.filter(id=pk, estado='publicado').first()
        if not publicacion:
            return Response({'error': 'No encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        reciente = timezone.now() - timedelta(hours=1)
        if Comentario.objects.filter(autor=usuario, creado_en__gte=reciente).count() >= MAX_COMENTARIOS_POR_HORA:
            return Response({'error': 'Has comentado muchas veces seguidas. Intenta de nuevo en un rato.'},
                            status=status.HTTP_429_TOO_MANY_REQUESTS)

        texto = str(request.data.get('texto', '')).strip()
        problema = _texto_valido(texto, 2, 500)
        if problema:
            return Response({'error': problema}, status=status.HTTP_400_BAD_REQUEST)

        if usuario.rol != 'administrador':
            palabra = revisar_texto(texto)
            if palabra:
                comentario = Comentario.objects.create(publicacion=publicacion, autor=usuario, texto=texto,
                                                       estado='bloqueado', palabra_detectada=palabra)
                return _bloqueo_por_vocabulario(usuario, comentario, 'comentario', palabra)

        comentario = Comentario.objects.create(publicacion=publicacion, autor=usuario, texto=texto)
        return Response(_serializar_comentario(comentario, usuario.id), status=status.HTTP_201_CREATED)


class ComentarioDetailView(APIView):
    permission_classes = [IsMongoAuthenticated]

    def delete(self, request, pk):
        usuario, error = _verificar(request)
        if error:
            return error
        comentario = Comentario.objects.filter(id=pk).first()
        if not comentario:
            return Response({'error': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        if comentario.autor_id != usuario.id and usuario.rol != 'administrador':
            return Response({'error': 'No puedes borrar el comentario de otra persona.'},
                            status=status.HTTP_403_FORBIDDEN)
        comentario.delete()
        return Response({'mensaje': 'Comentario eliminado.'})


# ----------------------------------------------------------------------------
# Seguir
# ----------------------------------------------------------------------------
class SeguirView(APIView):
    permission_classes = [IsMongoAuthenticated]

    def post(self, request, pk):
        usuario, error = _verificar(request)
        if error:
            return error
        if str(usuario.id) == str(pk):
            return Response({'error': 'No puedes seguirte a ti mismo.'}, status=status.HTTP_400_BAD_REQUEST)
        objetivo = Usuario.objects.filter(id=pk).first()
        if not objetivo:
            return Response({'error': 'Usuario no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        relacion = Seguimiento.objects.filter(seguidor=usuario, seguido=objetivo).first()
        if relacion:
            relacion.delete()
            siguiendo = False
        else:
            Seguimiento.objects.create(seguidor=usuario, seguido=objetivo)
            siguiendo = True
        return Response({'siguiendo': siguiendo})


# ----------------------------------------------------------------------------
# Moderación (solo administrador)
# ----------------------------------------------------------------------------
def _pendientes():
    return (Comentario.objects.filter(estado='bloqueado').count()
            + Publicacion.objects.filter(estado='bloqueado').count())


def _autor_admin(u):
    return {'id': u.id, 'nombre': f"{u.nombre} {u.apellido}".strip(), 'email': u.email, 'rol': u.rol}


class ModeracionResumenView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        return Response({'pendientes': _pendientes()})


class ModeracionView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        comentarios = Comentario.objects.filter(estado='bloqueado').select_related('autor', 'publicacion').order_by('-creado_en')
        publicaciones = Publicacion.objects.filter(estado='bloqueado').select_related('autor').order_by('-creado_en')
        restricciones = Restriccion.objects.select_related('usuario').order_by('-creada_en')
        rec_pub = Publicacion.objects.filter(estado='publicado').select_related('autor').order_by('-creado_en')[:15]
        rec_com = Comentario.objects.filter(estado='publicado').select_related('autor').order_by('-creado_en')[:15]

        return Response({
            'pendientes': _pendientes(),
            'comentarios_bloqueados': [{
                'id': c.id, 'texto': c.texto, 'palabra': c.palabra_detectada,
                'autor': _autor_admin(c.autor), 'creado_en': c.creado_en.isoformat(),
                'publicacion': c.publicacion.texto[:80],
            } for c in comentarios],
            'publicaciones_bloqueadas': [{
                'id': p.id, 'texto': p.texto, 'palabra': p.palabra_detectada,
                'autor': _autor_admin(p.autor), 'creado_en': p.creado_en.isoformat(),
            } for p in publicaciones],
            'restricciones': [{
                'usuario': _autor_admin(r.usuario),
                'hasta': r.hasta.isoformat() if r.hasta else None,
                'activa': r.activa, 'motivo': r.motivo,
            } for r in restricciones],
            'recientes_publicaciones': [{
                'id': p.id, 'texto': p.texto[:140], 'imagen': p.imagen,
                'autor': _autor_admin(p.autor), 'creado_en': p.creado_en.isoformat(),
            } for p in rec_pub],
            'recientes_comentarios': [{
                'id': c.id, 'texto': c.texto[:140],
                'autor': _autor_admin(c.autor), 'creado_en': c.creado_en.isoformat(),
            } for c in rec_com],
        })


class _ModeracionContenidoBase(APIView):
    """Restaurar (no era ofensivo) o eliminar (confirmado) un contenido bloqueado."""
    permission_classes = [IsAdminRole]
    modelo = None
    origen = ''

    def post(self, request, pk):
        objeto = self.modelo.objects.filter(id=pk).first()
        if not objeto:
            return Response({'error': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        accion = request.data.get('accion')

        if accion == 'restaurar':
            objeto.estado = 'publicado'
            objeto.save(update_fields=['estado'])
            # Si la suspensión de la persona vino de este mismo contenido, se levanta
            Restriccion.objects.filter(usuario_id=objeto.autor_id, origen=f'{self.origen}:{objeto.id}').delete()
            return Response({'mensaje': 'Restaurado y publicado. Se levantó la suspensión de la cuenta.'})

        if accion == 'eliminar':
            objeto.estado = 'rechazado'     # se conserva oculto como evidencia (cuenta como falta previa)
            objeto.save(update_fields=['estado'])
            return Response({'mensaje': 'Eliminado. La suspensión de la cuenta sigue vigente.'})

        return Response({'error': 'Acción no válida.'}, status=status.HTTP_400_BAD_REQUEST)


class ModeracionComentarioView(_ModeracionContenidoBase):
    modelo = Comentario
    origen = 'comentario'


class ModeracionPublicacionView(_ModeracionContenidoBase):
    modelo = Publicacion
    origen = 'publicacion'


class ModeracionUsuarioView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        usuario = Usuario.objects.filter(id=pk).first()
        if not usuario:
            return Response({'error': 'Usuario no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        accion = request.data.get('accion')

        if accion == 'desactivar':
            if usuario.rol == 'administrador':
                return Response({'error': 'No se puede desactivar a un administrador.'}, status=status.HTTP_400_BAD_REQUEST)
            desactivar_cuenta(usuario)
            return Response({'mensaje': 'Cuenta desactivada.'})
        if accion == 'reactivar':
            Restriccion.objects.filter(usuario=usuario).delete()
            return Response({'mensaje': 'Cuenta reactivada.'})
        return Response({'error': 'Acción no válida.'}, status=status.HTTP_400_BAD_REQUEST)