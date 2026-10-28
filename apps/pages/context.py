"""
apps/pages/context.py
Pone las imágenes fijas del sitio disponibles en TODAS las plantillas como "img".
Ejemplo en una plantilla:  {% if img.tienda_banner %}<img src="{{ img.tienda_banner }}">{% endif %}
"""
from .models import ImagenSitio


def site_images(request):
    try:
        return {'img': {i.clave: i.imagen for i in ImagenSitio.objects.all() if i.imagen}}
    except Exception:
        # Por ejemplo, si todavía no se ha corrido "migrate": el sitio no debe caerse
        return {'img': {}}