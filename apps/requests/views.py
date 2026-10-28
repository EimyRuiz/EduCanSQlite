from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from apps.core.authentication import IsMongoAuthenticated
from apps.core.uploads import guardar_archivo
from apps.users.models import Usuario
from .models import Solicitud
from .serializers import ServiceRequestSerializer

ESTADOS_VALIDOS = [e[0] for e in Solicitud.ESTADOS]


def serialize_solicitud(s):
    data = {
        'id': str(s.id),
        'servicio': s.servicio,
        'duracion': s.duracion,
        'fecha_inicio': str(s.fecha_inicio),
        'cliente_id': str(s.cliente_id),
        'cliente_nombre': s.cliente.email,
        'adiestrador_id': str(s.adiestrador_id) if s.adiestrador_id else None,
        'estado': s.estado,
        'perro_nombre': s.perro_nombre,
        'perro_raza': s.perro_raza,
        'perro_edad': s.perro_edad,
        'perro_peso': s.perro_peso,
        'perro_sexo': s.perro_sexo,
        'perro_esterilizado': s.perro_esterilizado,
        'perro_vacunas_al_dia': s.perro_vacunas_al_dia,
        'perro_conducta': s.perro_conducta,
        'perro_salud': s.perro_salud,
        'perro_foto': s.perro_foto,
        'creado_en': s.creado_en.isoformat(),
    }

    # select_related ya trajo al adiestrador: no hace falta otra consulta
    if s.adiestrador:
        data['adiestrador_info'] = {
            'nombre': s.adiestrador.nombre,
            'apellido': s.adiestrador.apellido,
            'foto': s.adiestrador.foto,
            'certificado': s.adiestrador.certificado,
            'especialidades': s.adiestrador.especialidades,
        }

    return data


def adiestrador_aprobado(user_id):
    """Devuelve el adiestrador si existe y está aprobado; si no, None."""
    return Usuario.objects.filter(
        id=user_id, rol='adiestrador', estado_aprobacion='aprobado'
    ).first()


class ServiceRequestListCreateView(APIView):
    permission_classes = [IsMongoAuthenticated]

    def get(self, request):
        rol = request.user.get('rol')
        user_id = request.user.get('user_id')
        base = Solicitud.objects.select_related('cliente', 'adiestrador')

        if rol == 'cliente':
            solicitudes = base.filter(cliente_id=user_id)

        elif rol == 'adiestrador':
            usuario = adiestrador_aprobado(user_id)
            # Pendiente o rechazado: no ve ninguna solicitud hasta que el admin lo apruebe
            if not usuario:
                return Response([])
            especialidades = usuario.especialidades or []
            solicitudes = base.filter(
                Q(estado='pendiente', servicio__in=especialidades) | Q(adiestrador_id=user_id)
            )

        else:  # administrador
            solicitudes = base.all()

        return Response([serialize_solicitud(s) for s in solicitudes])

    def post(self, request):
        # Solo los clientes piden servicios para sus mascotas
        if request.user.get('rol') != 'cliente':
            return Response({'error': 'Solo los clientes pueden solicitar servicios.'},
                            status=status.HTTP_403_FORBIDDEN)

        serializer = ServiceRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        cliente = Usuario.objects.get(id=request.user.get('user_id'))

        from apps.pets.models import Mascota
        try:
            mascota = Mascota.objects.get(id=data['mascota_id'], dueno_id=cliente.id)
        except Mascota.DoesNotExist:
            return Response({'error': 'Esa mascota no existe o no te pertenece.'}, status=status.HTTP_404_NOT_FOUND)

        solicitud = Solicitud.objects.create(
            cliente=cliente,
            servicio=data['servicio'],
            duracion=data['duracion'],
            fecha_inicio=data['fecha_inicio'],
            perro_nombre=mascota.nombre,
            perro_raza=mascota.raza,
            perro_edad=mascota.edad,
            perro_peso=mascota.peso,
            perro_sexo=mascota.sexo,
            perro_esterilizado=mascota.esterilizado,
            perro_vacunas_al_dia=mascota.vacunas_al_dia,
            perro_conducta=mascota.conducta,
            perro_salud=mascota.salud,
            perro_foto=mascota.foto,
        )

        return Response(
            {'mensaje': 'Solicitud creada.', 'id': str(solicitud.id)},
            status=status.HTTP_201_CREATED
        )


class ServiceRequestDetailView(APIView):
    """Edición manual de una solicitud: SOLO el administrador."""
    permission_classes = [IsMongoAuthenticated]

    def patch(self, request, pk):
        if request.user.get('rol') != 'administrador':
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            solicitud = Solicitud.objects.get(id=pk)
        except Solicitud.DoesNotExist:
            return Response({'error': 'No encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        if 'estado' in request.data:
            if request.data['estado'] not in ESTADOS_VALIDOS:
                return Response({'error': 'Estado no válido.'}, status=status.HTTP_400_BAD_REQUEST)
            solicitud.estado = request.data['estado']

        if 'adiestrador_id' in request.data:
            nuevo = request.data['adiestrador_id']
            if nuevo in (None, ''):
                solicitud.adiestrador = None
            else:
                adiestrador = adiestrador_aprobado(nuevo)
                if not adiestrador:
                    return Response({'error': 'Ese adiestrador no existe o no está aprobado.'},
                                    status=status.HTTP_400_BAD_REQUEST)
                solicitud.adiestrador = adiestrador

        solicitud.save()
        return Response({'mensaje': 'Solicitud actualizada.'})


class UploadPerroFotoView(APIView):
    """Foto del perro de una solicitud. Solo el cliente que la creó puede cambiarla."""
    permission_classes = [IsMongoAuthenticated]

    def post(self, request, pk):
        archivo = request.FILES.get('foto')
        if not archivo:
            return Response({'error': 'No se envió ninguna imagen.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            solicitud = Solicitud.objects.get(id=pk, cliente_id=request.user.get('user_id'))
        except Solicitud.DoesNotExist:
            return Response({'error': 'No encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            url_foto = guardar_archivo(archivo, 'perros', pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        solicitud.perro_foto = url_foto
        solicitud.save()

        return Response({'mensaje': 'Foto del perro guardada.', 'foto': url_foto})


class AceptarSolicitudView(APIView):
    permission_classes = [IsMongoAuthenticated]

    def post(self, request, pk):
        if request.user.get('rol') != 'adiestrador':
            return Response({'error': 'Solo un adiestrador puede aceptar solicitudes.'}, status=status.HTTP_403_FORBIDDEN)

        # Debe estar aprobado por el administrador
        adiestrador = adiestrador_aprobado(request.user.get('user_id'))
        if not adiestrador:
            return Response({'error': 'Tu cuenta aún no ha sido aprobada por el administrador.'},
                            status=status.HTTP_403_FORBIDDEN)

        try:
            solicitud = Solicitud.objects.get(id=pk)
        except Solicitud.DoesNotExist:
            return Response({'error': 'No encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        if solicitud.estado != 'pendiente':
            return Response({'error': 'Esta solicitud ya fue tomada por otro adiestrador.'}, status=status.HTTP_400_BAD_REQUEST)

        # Solo puede aceptar servicios de sus especialidades aprobadas
        if solicitud.servicio not in (adiestrador.especialidades or []):
            return Response({'error': 'Ese servicio no está entre tus especialidades.'},
                            status=status.HTTP_403_FORBIDDEN)

        solicitud.adiestrador = adiestrador
        solicitud.estado = 'aceptada'
        solicitud.save()

        return Response({'mensaje': 'Solicitud aceptada.'})


class CompletarSolicitudView(APIView):
    permission_classes = [IsMongoAuthenticated]

    def post(self, request, pk):
        try:
            solicitud = Solicitud.objects.get(id=pk)
        except Solicitud.DoesNotExist:
            return Response({'error': 'No encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        if str(solicitud.adiestrador_id) != str(request.user.get('user_id')):
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        if solicitud.estado != 'aceptada':
            return Response({'error': 'Solo se puede completar una solicitud aceptada.'}, status=status.HTTP_400_BAD_REQUEST)

        solicitud.estado = 'completado'
        solicitud.save()
        return Response({'mensaje': 'Solicitud marcada como completada.'})