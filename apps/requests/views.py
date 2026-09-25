import os
from django.conf import settings
from django.core.files.storage import FileSystemStorage
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from apps.core.authentication import IsMongoAuthenticated
from apps.users.models import Usuario
from .models import Solicitud
from .serializers import ServiceRequestSerializer


def serialize_solicitud(s):
    return {
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


class ServiceRequestListCreateView(APIView):
    permission_classes = [IsMongoAuthenticated]

    def get(self, request):
        rol = request.user.get('rol')
        user_id = request.user.get('user_id')

        if rol == 'cliente':
            solicitudes = Solicitud.objects.filter(cliente_id=user_id)

        elif rol == 'adiestrador':
            usuario = Usuario.objects.get(id=user_id)
            especialidades = usuario.especialidades or []
            from django.db.models import Q
            solicitudes = Solicitud.objects.filter(
                Q(estado='pendiente', servicio__in=especialidades) | Q(adiestrador_id=user_id)
            )

        else:  # administrador
            solicitudes = Solicitud.objects.all()

        return Response([serialize_solicitud(s) for s in solicitudes])

    def post(self, request):
        serializer = ServiceRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        cliente = Usuario.objects.get(id=request.user.get('user_id'))

        from apps.pets.models import Mascota
        try:
            mascota=Mascota.objects.get(id=data['mascota_id'], dueno_id=cliente.id)
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
    permission_classes = [IsMongoAuthenticated]

    def patch(self, request, pk):
        try:
            solicitud = Solicitud.objects.get(id=pk)
        except Solicitud.DoesNotExist:
            return Response({'error': 'No encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        if 'adiestrador_id' in request.data:
            solicitud.adiestrador_id = request.data['adiestrador_id']
        if 'estado' in request.data:
            solicitud.estado = request.data['estado']
        solicitud.save()

        return Response({'mensaje': 'Solicitud actualizada.'})


class UploadPerroFotoView(APIView):
    permission_classes = [IsMongoAuthenticated]

    def post(self, request, pk):
        archivo = request.FILES.get('foto')
        if not archivo:
            return Response({'error': 'No se envió ninguna imagen.'}, status=status.HTTP_400_BAD_REQUEST)

        carpeta = os.path.join(settings.MEDIA_ROOT, 'perros')
        os.makedirs(carpeta, exist_ok=True)
        nombre_archivo = f"{pk}_{archivo.name}"
        FileSystemStorage(location=carpeta).save(nombre_archivo, archivo)
        url_foto = f"{settings.MEDIA_URL}perros/{nombre_archivo}"

        solicitud = Solicitud.objects.get(id=pk)
        solicitud.perro_foto = url_foto
        solicitud.save()

        return Response({'mensaje': 'Foto del perro guardada.', 'foto': url_foto})


class AceptarSolicitudView(APIView):
    permission_classes = [IsMongoAuthenticated]

    def post(self, request, pk):
        if request.user.get('rol') != 'adiestrador':
            return Response({'error': 'Solo un adiestrador puede aceptar solicitudes.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            solicitud = Solicitud.objects.get(id=pk)
        except Solicitud.DoesNotExist:
            return Response({'error': 'No encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        if solicitud.estado != 'pendiente':
            return Response({'error': 'Esta solicitud ya fue tomada por otro adiestrador.'}, status=status.HTTP_400_BAD_REQUEST)

        solicitud.adiestrador_id = request.user.get('user_id')
        solicitud.estado = 'aceptada'
        solicitud.save()

        return Response({'mensaje': 'Solicitud aceptada.'})