"""
apps/core/media_files.py
Funciones para guardar y borrar imágenes subidas (productos, servicios, imágenes del sitio).
La imagen se guarda en la carpeta media/ y en la base de datos queda su ruta (/media/...).
"""
import os
import uuid
from django.conf import settings
from django.core.files.storage import FileSystemStorage

EXTENSIONES = {'.jpg', '.jpeg', '.png', '.webp'}
PESO_MAXIMO = 4 * 1024 * 1024   # 4 MB


def _parece_imagen(archivo):
    """Revisa los primeros bytes del archivo (no confía solo en la extensión)."""
    cabecera = archivo.read(12)
    archivo.seek(0)
    return (
        cabecera.startswith(b'\xff\xd8\xff')                              # JPG
        or cabecera.startswith(b'\x89PNG\r\n\x1a\n')                      # PNG
        or (cabecera[:4] == b'RIFF' and cabecera[8:12] == b'WEBP')        # WEBP
    )


def guardar_imagen(archivo, carpeta, prefijo=''):
    """
    Valida y guarda la imagen en media/<carpeta>/ con un nombre único.
    Devuelve la ruta pública, por ejemplo: /media/productos/3_a1b2c3d4e5f6.jpg
    Si algo está mal lanza ValueError con un mensaje en español.
    """
    extension = os.path.splitext(archivo.name)[1].lower()
    if extension not in EXTENSIONES:
        raise ValueError('Formato no permitido. Usa una imagen JPG, PNG o WEBP.')
    if archivo.size > PESO_MAXIMO:
        raise ValueError('La imagen pesa más de 4 MB. Usa una más liviana.')
    if not _parece_imagen(archivo):
        raise ValueError('El archivo no parece ser una imagen válida.')

    destino = os.path.join(settings.MEDIA_ROOT, carpeta)
    os.makedirs(destino, exist_ok=True)
    nombre = f"{prefijo}{uuid.uuid4().hex[:12]}{extension}"
    FileSystemStorage(location=destino).save(nombre, archivo)
    return f"{settings.MEDIA_URL}{carpeta}/{nombre}"


def borrar_archivo(ruta):
    """Borra del disco un archivo subido antes (solo si está dentro de media/)."""
    if not ruta or not str(ruta).startswith(settings.MEDIA_URL):
        return
    relativa = str(ruta)[len(settings.MEDIA_URL):]
    completa = os.path.realpath(os.path.join(settings.MEDIA_ROOT, relativa))
    base = os.path.realpath(settings.MEDIA_ROOT)
    if completa.startswith(base + os.sep) and os.path.isfile(completa):
        try:
            os.remove(completa)
        except OSError:
            pass