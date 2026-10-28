from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from apps.core.authentication import AdminWriteOrReadOnly
from .models import Servicio
from .serializers import ServiceSerializer


def serialize_servicio(s):
    return {
        'id': str(s.id),
        'nombre': s.nombre,
        'descripcion': s.descripcion,
        'precio': s.precio,
        'imagen': s.imagen,
    }


def existe_duplicado(nombre, excluir_id=None):
    # Un servicio es duplicado si ya existe otro con el mismo nombre (sin importar mayúsculas).
    consulta = Servicio.objects.filter(nombre__iexact=nombre)
    if excluir_id:
        consulta = consulta.exclude(id=excluir_id)
    return consulta.exists()


class ServiceListCreateView(APIView):
    permission_classes = [AdminWriteOrReadOnly]

    def get(self, request):
        servicios = Servicio.objects.all()
        return Response([serialize_servicio(s) for s in servicios])

    def post(self, request):
        serializer = ServiceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if existe_duplicado(serializer.validated_data['nombre']):
            return Response({'error': 'Ya existe un servicio con ese nombre.'},
                            status=status.HTTP_400_BAD_REQUEST)
        servicio = Servicio.objects.create(**serializer.validated_data)
        return Response({'mensaje': 'Servicio creado.', 'id': str(servicio.id)},
                        status=status.HTTP_201_CREATED)


class ServiceDetailView(APIView):
    permission_classes = [AdminWriteOrReadOnly]

    def get_object(self, pk):
        try:
            return Servicio.objects.get(id=pk)
        except Servicio.DoesNotExist:
            return None

    def get(self, request, pk):
        servicio = self.get_object(pk)
        if not servicio:
            return Response({'error': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(serialize_servicio(servicio))

    def put(self, request, pk):
        servicio = self.get_object(pk)
        if not servicio:
            return Response({'error': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ServiceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if existe_duplicado(serializer.validated_data['nombre'], excluir_id=servicio.id):
            return Response({'error': 'Ya existe un servicio con ese nombre.'},
                            status=status.HTTP_400_BAD_REQUEST)
        for campo, valor in serializer.validated_data.items():
            setattr(servicio, campo, valor)
        servicio.save()
        return Response({'mensaje': 'Servicio actualizado.'})

    def delete(self, request, pk):
        servicio = self.get_object(pk)
        if not servicio:
            return Response({'error': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        servicio.delete()
        return Response({'mensaje': 'Servicio eliminado.'}, status=status.HTTP_204_NO_CONTENT)