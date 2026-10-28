from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from apps.core.authentication import AdminWriteOrReadOnly
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


def existe_duplicado(nombre, categoria, excluir_id=None):
    # Duplicado = mismo nombre y misma categoría (sin importar mayúsculas).
    consulta = Producto.objects.filter(nombre__iexact=nombre, categoria=categoria)
    if excluir_id:
        consulta = consulta.exclude(id=excluir_id)
    return consulta.exists()


class ProductListCreateView(APIView):
    permission_classes = [AdminWriteOrReadOnly]

    def get(self, request):
        productos = Producto.objects.all()
        return Response([serialize_producto(p) for p in productos])

    def post(self, request):
        serializer = ProductSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        if existe_duplicado(datos['nombre'], datos['categoria']):
            return Response({'error': 'Ya existe un producto con ese nombre en esa categoría.'},
                            status=status.HTTP_400_BAD_REQUEST)
        producto = Producto.objects.create(**datos)
        return Response({'mensaje': 'Producto creado.', 'id': str(producto.id)},
                        status=status.HTTP_201_CREATED)


class ProductDetailView(APIView):
    permission_classes = [AdminWriteOrReadOnly]

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
        datos = serializer.validated_data
        if existe_duplicado(datos['nombre'], datos['categoria'], excluir_id=producto.id):
            return Response({'error': 'Ya existe un producto con ese nombre en esa categoría.'},
                            status=status.HTTP_400_BAD_REQUEST)
        for campo, valor in datos.items():
            setattr(producto, campo, valor)
        producto.save()
        return Response({'mensaje': 'Producto actualizado.'})

    def delete(self, request, pk):
        producto = self.get_object(pk)
        if not producto:
            return Response({'error': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        producto.delete()
        return Response({'mensaje': 'Producto eliminado.'}, status=status.HTTP_204_NO_CONTENT)