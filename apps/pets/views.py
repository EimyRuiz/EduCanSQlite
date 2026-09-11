from django.shortcuts import render

# Create your views here.
import os
from bson import ObjectId
from bson.errors import InvalidId
from django.conf import settings
from django.core.files.storage import FileSystemStorage
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from apps.core.mongo import db
from apps.core.authentication import IsMongoAuthenticated
from .serializers import PetSerializer


def serialize_pet(doc):
    doc['id'] = str(doc['_id'])
    doc.pop('_id')
    return doc


class PetListCreateView(APIView):
    permission_classes = [IsMongoAuthenticated]

    def get(self, request):
        # Un cliente solo ve SUS mascotas
        user_id = request.user.get('user_id')
        mascotas = list(db.mascotas.find({'dueno_id': user_id}))
        return Response([serialize_pet(m) for m in mascotas])

    def post(self, request):
        serializer = PetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        nueva_mascota = {
            **data,
            'dueno_id': request.user.get('user_id'),
            'foto': None,
        }
        resultado = db.mascotas.insert_one(nueva_mascota)
        return Response(
            {'mensaje': 'Mascota registrada.', 'id': str(resultado.inserted_id)},
            status=status.HTTP_201_CREATED
        )


class PetDetailView(APIView):
    permission_classes = [IsMongoAuthenticated]

    def get_object(self, pk, user_id):
        try:
            # Solo permite acceder si la mascota le pertenece al usuario que pide
            return db.mascotas.find_one({'_id': ObjectId(pk), 'dueno_id': user_id})
        except InvalidId:
            return None

    def put(self, request, pk):
        user_id = request.user.get('user_id')
        mascota = self.get_object(pk, user_id)
        if not mascota:
            return Response({'error': 'No encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = PetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        db.mascotas.update_one({'_id': ObjectId(pk)}, {'$set': serializer.validated_data})
        return Response({'mensaje': 'Mascota actualizada.'})

    def delete(self, request, pk):
        user_id = request.user.get('user_id')
        mascota = self.get_object(pk, user_id)
        if not mascota:
            return Response({'error': 'No encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        db.mascotas.delete_one({'_id': ObjectId(pk)})
        return Response({'mensaje': 'Mascota eliminada.'}, status=status.HTTP_204_NO_CONTENT)


class UploadPetFotoView(APIView):
    permission_classes = [IsMongoAuthenticated]

    def post(self, request, pk):
        archivo = request.FILES.get('foto')
        if not archivo:
            return Response({'error': 'No se envió ninguna imagen.'}, status=status.HTTP_400_BAD_REQUEST)

        carpeta = os.path.join(settings.MEDIA_ROOT, 'mascotas')
        os.makedirs(carpeta, exist_ok=True)

        nombre_archivo = f"{pk}_{archivo.name}"
        fs = FileSystemStorage(location=carpeta)
        fs.save(nombre_archivo, archivo)

        url_foto = f"{settings.MEDIA_URL}mascotas/{nombre_archivo}"
        db.mascotas.update_one({'_id': ObjectId(pk)}, {'$set': {'foto': url_foto}})

        return Response({'mensaje': 'Foto guardada.', 'foto': url_foto})