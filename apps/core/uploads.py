"""
apps/core/uploads.py
Validación y guardado seguro de los archivos que suben los usuarios (fotos y certificados).

Reglas:
- Tamaño máximo: 5 MB.
- Imágenes: JPG, PNG o WEBP. Certificados: esas mismas o PDF.
- Se revisa el CONTENIDO real del archivo (sus primeros bytes), no solo la extensión,
  para que nadie suba un programa renombrado como ".jpg".
- El archivo se guarda con un nombre generado (no con el nombre que puso el usuario).
"""
import os
import uuid

from django.conf import settings
from django.core.files.storage import FileSystemStorage

TAMANO_MAXIMO = 5 * 1024 * 1024  # 5 MB

# extensión permitida -> tipo real que debe tener el contenido
TIPOS_IMAGEN = {'.jpg': 'jpg', '.jpeg': 'jpg', '.png': 'png', '.webp': 'webp'}
TIPOS_CERTIFICADO = {**TIPOS_IMAGEN, '.pdf': 'pdf'}


def _tipo_real(archivo):
    """Mira los primeros bytes del archivo y dice qué es: 'jpg', 'png', 'webp', 'pdf' o None."""
    inicio = archivo.read(16)
    archivo.seek(0)
    if inicio.startswith(b'\xff\xd8\xff'):
        return 'jpg'
    if inicio.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'png'
    if inicio[:4] == b'RIFF' and inicio[8:12] == b'WEBP':
        return 'webp'
    if inicio.startswith(b'%PDF-'):
        return 'pdf'
    return None


def guardar_archivo(archivo, subcarpeta, prefijo, permitir_pdf=False):
    """
    Valida el archivo y lo guarda en media/<subcarpeta>/.
    Devuelve la URL pública (ej. /media/perfiles/3_ab12cd.jpg).
    Si el archivo no es válido lanza ValueError con un mensaje en español para el usuario.
    """
    if archivo.size > TAMANO_MAXIMO:
        raise ValueError('El archivo pesa más de 5 MB.')

    permitidos = TIPOS_CERTIFICADO if permitir_pdf else TIPOS_IMAGEN
    extension = os.path.splitext(archivo.name)[1].lower()
    if extension not in permitidos:
        formatos = 'JPG, PNG, WEBP o PDF' if permitir_pdf else 'JPG, PNG o WEBP'
        raise ValueError(f'Formato no permitido. Usa {formatos}.')

    if _tipo_real(archivo) != permitidos[extension]:
        raise ValueError('El contenido del archivo no coincide con su formato.')

    carpeta = os.path.join(settings.MEDIA_ROOT, subcarpeta)
    os.makedirs(carpeta, exist_ok=True)
    nombre = f"{prefijo}_{uuid.uuid4().hex[:12]}{extension}"
    FileSystemStorage(location=carpeta).save(nombre, archivo)
    return f"{settings.MEDIA_URL}{subcarpeta}/{nombre}"