from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from apps.core.authentication import IsMongoAuthenticated
from apps.requests.models import Solicitud
from .models import Resena
from .serializers import ResenaSerializer


def serialize_resena(r):
    return {
        'id': r.id,
        'solicitud_id': r.solicitud_id,
        'cliente_nombre': f"{r.cliente.nombre} {r.cliente.apellido}",
        'cliente_foto': r.cliente.foto,
        'servicio': r.solicitud.servicio,
        'estrellas': r.estrellas,
        'comentario': r.comentario,
        'respuesta_admin': r.respuesta_admin,
        'creado_en': r.creado_en.isoformat(),
    }


class ResenaListCreateView(APIView):
    permission_classes = [IsMongoAuthenticated]

    def get(self, request):
        # Público para cualquier usuario logueado (se usa también sin auth en el landing, ver nota abajo)
        resenas = Resena.objects.all().order_by('-creado_en')
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


class ResponderResenaView(APIView):
    permission_classes = [IsMongoAuthenticated]

    def post(self, request, pk):
        if request.user.get('rol') != 'administrador':
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            resena = Resena.objects.get(id=pk)
        except Resena.DoesNotExist:
            return Response({'error': 'No encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        resena.respuesta_admin = request.data.get('respuesta', '')
        resena.save()
        return Response({'mensaje': 'Respuesta guardada.'})


class EstadisticasView(APIView):
    def get(self, request):
        total_servicios = Solicitud.objects.filter(estado__in=['aceptada', 'completado']).count()
        resenas = Resena.objects.all()
        total_resenas = resenas.count()
        buenas = resenas.filter(estrellas__gte=4).count()
        porcentaje_satisfaccion = round((buenas / total_resenas) * 100) if total_resenas else 0

        return Response({
            'perros_entrenados': total_servicios,
            'porcentaje_satisfaccion': porcentaje_satisfaccion,
            'total_resenas': total_resenas,
        })