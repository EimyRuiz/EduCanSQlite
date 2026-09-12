from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import Producto
from .serializers import ProductSerializer


def serialize_producto(p):
    return {
        'id': str(p.id),
        'nombre': p.nombre,
        'categoria': p.categoria,
        'descripcion': p.descripcion,
        'precio': p.precio,
        'imagen': p.imagen,
    }


class ProductListCreateView(APIView):
    def get(self, request):
        productos = Producto.objects.all()
        return Response([serialize_producto(p) for p in productos])

    def post(self, request):
        serializer = ProductSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        producto = Producto.objects.create(**serializer.validated_data)
        return Response({'mensaje': 'Producto creado.', 'id': str(producto.id)}, status=status.HTTP_201_CREATED)


class ProductDetailView(APIView):
    def get_object(self, pk):
        try:
            return Producto.objects.get(id=pk)
        except Producto.DoesNotExist:
            return None

    def get(self, request, pk):
        producto = self.get_object(pk)
        if not producto:
            return Response({'error': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(serialize_producto(producto))

    def put(self, request, pk):
        producto = self.get_object(pk)
        if not producto:
            return Response({'error': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ProductSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        for campo, valor in serializer.validated_data.items():
            setattr(producto, campo, valor)
        producto.save()
        return Response({'mensaje': 'Producto actualizado.'})

    def delete(self, request, pk):
        producto = self.get_object(pk)
        if not producto:
            return Response({'error': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        producto.delete()
        return Response({'mensaje': 'Producto eliminado.'}, status=status.HTTP_204_NO_CONTENT)