from django.db import models

# Imágenes fijas del sitio que el administrador sube desde su panel.
# clave -> descripción que ve el administrador. Las plantillas las usan como img.<clave>
SLOTS_IMAGEN = {
    'tienda_banner': 'Tienda — banner principal',
    'nosotros_principal': 'Nosotros — foto principal',
    'nosotros_historia': 'Nosotros — foto de nuestra historia',
    'galeria_1': 'Inicio, galería — foto grande',
    'galeria_2': 'Inicio, galería — foto 2',
    'galeria_3': 'Inicio, galería — foto 3',
    'galeria_4': 'Inicio, galería — foto 4',
    'galeria_5': 'Inicio, galería — foto 5',
}


class ImagenSitio(models.Model):
    clave = models.CharField(max_length=50, unique=True)
    imagen = models.CharField(max_length=300, blank=True, default='')   # ruta /media/sitio/...
    actualizado_en = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.clave


class Mensaje(models.Model):
    """Mensaje enviado desde el formulario de la página de Contacto."""
    MOTIVOS = [
        ('educacion', 'Servicios de adiestramiento'),
        ('tienda', 'Tienda y productos'),
        ('otro', 'Otro'),
    ]
    nombre = models.CharField(max_length=100)
    email = models.EmailField()
    telefono = models.CharField(max_length=20, blank=True, default='')
    motivo = models.CharField(max_length=20, choices=MOTIVOS, default='otro')
    mensaje = models.TextField(max_length=1500)
    leido = models.BooleanField(default=False)
    creado_en = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nombre} — {self.get_motivo_display()}"