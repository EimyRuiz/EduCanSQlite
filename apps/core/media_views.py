"""
apps/core/media_views.py
Subida de imágenes desde el panel del administrador:
  - foto de un producto      POST /api/products/<id>/imagen/
  - foto de un servicio      POST /api/services/<id>/imagen/
  - imágenes fijas del sitio GET  /api/site-images/
                             POST/DELETE /api/site-images/<clave>/
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from apps.core.authentication import IsAdminRole
from apps.core.media_files import guardar_imagen, borrar_archivo
from apps.shop.models import Producto
from apps.training.models import Servicio
from apps.pages.models import ImagenSitio, SLOTS_IMAGEN


class _SubirImagenBase(APIView):
    """Lógica común: recibe el archivo en el campo 'imagen' y lo guarda en el objeto."""
    permission_classes = [IsAdminRole]
    modelo = None
    carpeta = ''

    def post(self, request, pk):
        objeto = self.modelo.objects.filter(id=pk).first()
        if not objeto:
            return Response({'error': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        archivo = request.FILES.get('imagen')
        if not archivo:
            return Response({'error': 'No se envió ninguna imagen.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            ruta = guardar_imagen(archivo, self.carpeta, prefijo=f"{pk}_")
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        anterior = objeto.imagen
        objeto.imagen = ruta
        objeto.save(update_fields=['imagen'])
        borrar_archivo(anterior)        # no dejamos fotos viejas ocupando espacio
        return Response({'mensaje': 'Imagen guardada.', 'imagen': ruta})


class ProductoImagenView(_SubirImagenBase):
    modelo = Producto
    carpeta = 'productos'


class ServicioImagenView(_SubirImagenBase):
    modelo = Servicio
    carpeta = 'servicios'


class ImagenSitioListView(APIView):
    """Lista todas las imágenes fijas del sitio (con o sin foto subida)."""
    permission_classes = [IsAdminRole]

    def get(self, request):
        subidas = {i.clave: i.imagen for i in ImagenSitio.objects.all()}
        return Response([
            {'clave': clave, 'descripcion': descripcion, 'imagen': subidas.get(clave, '')}
            for clave, descripcion in SLOTS_IMAGEN.items()
        ])


class ImagenSitioView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request, clave):
        if clave not in SLOTS_IMAGEN:
            return Response({'error': 'Esa imagen no existe.'}, status=status.HTTP_404_NOT_FOUND)
        archivo = request.FILES.get('imagen')
        if not archivo:
            return Response({'error': 'No se envió ninguna imagen.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            ruta = guardar_imagen(archivo, 'sitio', prefijo=f"{clave}_")
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        registro, _ = ImagenSitio.objects.get_or_create(clave=clave)
        borrar_archivo(registro.imagen)
        registro.imagen = ruta
        registro.save()
        return Response({'mensaje': 'Imagen guardada.', 'imagen': ruta})

    def delete(self, request, clave):
        registro = ImagenSitio.objects.filter(clave=clave).first()
        if registro:
            borrar_archivo(registro.imagen)
            registro.delete()
        return Response({'mensaje': 'Imagen quitada.'})