from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from apps.core.authentication import IsMongoAuthenticated
from apps.core.uploads import guardar_archivo
from apps.users.models import Usuario
from .models import Mascota
from .serializers import PetSerializer


def serialize_mascota(m):
    return {
        'id': str(m.id),
        'dueno_id': str(m.dueno_id),
        'nombre': m.nombre,
        'raza': m.raza,
        'edad': m.edad,
        'peso': m.peso,
        'sexo': m.sexo,
        'esterilizado': m.esterilizado,
        'vacunas_al_dia': m.vacunas_al_dia,
        'conducta': m.conducta,
        'salud': m.salud,
        'foto': m.foto,
    }


class PetListCreateView(APIView):
    permission_classes = [IsMongoAuthenticated]

    def get(self, request):
        user_id = request.user.get('user_id')
        mascotas = Mascota.objects.filter(dueno_id=user_id)
        return Response([serialize_mascota(m) for m in mascotas])

    def post(self, request):
        serializer = PetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dueno = Usuario.objects.get(id=request.user.get('user_id'))
        mascota = Mascota.objects.create(dueno=dueno, **serializer.validated_data)
        return Response(
            {'mensaje': 'Mascota registrada.', 'id': str(mascota.id)},
            status=status.HTTP_201_CREATED
        )


class PetDetailView(APIView):
    permission_classes = [IsMongoAuthenticated]

    def get_object(self, pk, user_id):
        try:
            return Mascota.objects.get(id=pk, dueno_id=user_id)
        except Mascota.DoesNotExist:
            return None

    def put(self, request, pk):
        user_id = request.user.get('user_id')
        mascota = self.get_object(pk, user_id)
        if not mascota:
            return Response({'error': 'No encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = PetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        for campo, valor in serializer.validated_data.items():
            setattr(mascota, campo, valor)
        mascota.save()
        return Response({'mensaje': 'Mascota actualizada.'})

    def delete(self, request, pk):
        user_id = request.user.get('user_id')
        mascota = self.get_object(pk, user_id)
        if not mascota:
            return Response({'error': 'No encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        mascota.delete()
        return Response({'mensaje': 'Mascota eliminada.'}, status=status.HTTP_204_NO_CONTENT)


class UploadPetFotoView(APIView):
    """Foto de una mascota. Solo su dueño puede cambiarla. JPG, PNG o WEBP de hasta 5 MB."""
    permission_classes = [IsMongoAuthenticated]

    def post(self, request, pk):
        archivo = request.FILES.get('foto')
        if not archivo:
            return Response({'error': 'No se envió ninguna imagen.'}, status=status.HTTP_400_BAD_REQUEST)

        # La mascota debe existir Y pertenecer al usuario que hace la petición
        try:
            mascota = Mascota.objects.get(id=pk, dueno_id=request.user.get('user_id'))
        except Mascota.DoesNotExist:
            return Response({'error': 'No encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            url_foto = guardar_archivo(archivo, 'mascotas', pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        mascota.foto = url_foto
        mascota.save()

        return Response({'mensaje': 'Foto guardada.', 'foto': url_foto})