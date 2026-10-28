from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status

from apps.core.authentication import IsMongoAuthenticated
from apps.requests.models import Solicitud
from .models import Resena
from .serializers import ResenaSerializer


def serialize_resena(r, puede_editar=True):
    """
    puede_editar: si quien consulta puede modificar la respuesta (lo calcula la vista).
    Si respondió un adiestrador se muestra su nombre; si respondió el admin
    (o es una respuesta antigua sin autor) se muestra "EDUCAN".
    """
    autor = r.respondido_por
    es_adiestrador = bool(autor and autor.rol == 'adiestrador')
    return {
        'id': r.id,
        'solicitud_id': r.solicitud_id,
        'cliente_nombre': f"{r.cliente.nombre} {r.cliente.apellido}",
        'cliente_foto': r.cliente.foto,
        'servicio': r.solicitud.servicio,
        'perro_nombre': r.solicitud.perro_nombre,
        'estrellas': r.estrellas,
        'comentario': r.comentario,
        'respuesta_admin': r.respuesta_admin,
        'respondido_por_id': autor.id if autor else None,
        'respondido_por_nombre': f"{autor.nombre} {autor.apellido}" if es_adiestrador else 'EDUCAN',
        'respondido_por_rol': 'adiestrador' if es_adiestrador else 'administrador',
        'puede_editar': puede_editar,
        'creado_en': r.creado_en.isoformat(),
    }


class ResenaListCreateView(APIView):

    def get_permissions(self):
        # Ver reseñas es público (testimonios del Inicio).
        # Crear una reseña exige haber iniciado sesión.
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsMongoAuthenticated()]

    def get(self, request):
        resenas = (Resena.objects
                   .select_related('cliente', 'solicitud', 'respondido_por')
                   .order_by('-creado_en'))
        return Response([serialize_resena(r) for r in resenas])

    def post(self, request):
        serializer = ResenaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user_id = request.user.get('user_id')
        try:
            solicitud = Solicitud.objects.get(id=data['solicitud_id'], cliente_id=user_id)
        except Solicitud.DoesNotExist:
            return Response({'error': 'Esa solicitud no existe o no te pertenece.'}, status=status.HTTP_404_NOT_FOUND)

        if solicitud.estado != 'completado':
            return Response({'error': 'Solo puedes calificar servicios ya completados.'}, status=status.HTTP_400_BAD_REQUEST)

        if hasattr(solicitud, 'resena'):
            return Response({'error': 'Ya calificaste este servicio.'}, status=status.HTTP_400_BAD_REQUEST)

        resena = Resena.objects.create(
            cliente_id=user_id,
            solicitud=solicitud,
            estrellas=data['estrellas'],
            comentario=data.get('comentario', ''),
        )
        return Response({'mensaje': 'Reseña enviada.', 'id': resena.id}, status=status.HTTP_201_CREATED)


class MisResenasView(APIView):
    """Reseñas de los servicios que completó el adiestrador que hace la petición."""
    permission_classes = [IsMongoAuthenticated]

    def get(self, request):
        if request.user.get('rol') != 'adiestrador':
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        user_id = request.user.get('user_id')
        resenas = (Resena.objects
                   .select_related('cliente', 'solicitud', 'respondido_por')
                   .filter(solicitud__adiestrador_id=user_id)
                   .order_by('-creado_en'))

        # El adiestrador puede editar si nadie respondió, si la respuesta es suya o es antigua (sin autor);
        # no puede pisar una respuesta que escribió el administrador.
        def puede_editar(r):
            return r.respondido_por_id is None or str(r.respondido_por_id) == str(user_id)

        return Response([serialize_resena(r, puede_editar(r)) for r in resenas])


class ResponderResenaView(APIView):
    """Responde una reseña. Pueden hacerlo: el administrador, o el adiestrador de ese servicio."""
    permission_classes = [IsMongoAuthenticated]

    def post(self, request, pk):
        rol = request.user.get('rol')
        user_id = request.user.get('user_id')

        try:
            resena = Resena.objects.select_related('solicitud').get(id=pk)
        except Resena.DoesNotExist:
            return Response({'error': 'No encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        es_admin = rol == 'administrador'
        es_su_adiestrador = (rol == 'adiestrador'
                             and str(resena.solicitud.adiestrador_id) == str(user_id))
        if not (es_admin or es_su_adiestrador):
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        # Un adiestrador no puede modificar la respuesta que dejó otra persona (el admin)
        if (not es_admin and resena.respondido_por_id
                and str(resena.respondido_por_id) != str(user_id)):
            return Response({'error': 'Esta reseña ya fue respondida por el administrador.'},
                            status=status.HTTP_403_FORBIDDEN)

        respuesta = str(request.data.get('respuesta', '')).strip()
        if len(respuesta) > 500:
            return Response({'error': 'La respuesta no puede superar 500 caracteres.'},
                            status=status.HTTP_400_BAD_REQUEST)

        resena.respuesta_admin = respuesta
        # Si borran la respuesta, también se borra el autor
        resena.respondido_por_id = user_id if respuesta else None
        resena.save()
        return Response({'mensaje': 'Respuesta guardada.'})


class EstadisticasView(APIView):
    # Público: alimenta los números del Inicio.
    permission_classes = [AllowAny]

    def get(self, request):
        # Un perro "entrenado" es el de un servicio ya completado.
        total_servicios = Solicitud.objects.filter(estado='completado').count()
        resenas = Resena.objects.all()
        total_resenas = resenas.count()
        buenas = resenas.filter(estrellas__gte=4).count()
        porcentaje_satisfaccion = round((buenas / total_resenas) * 100) if total_resenas else 0

        return Response({
            'perros_entrenados': total_servicios,
            'porcentaje_satisfaccion': porcentaje_satisfaccion,
            'total_resenas': total_resenas,
        })