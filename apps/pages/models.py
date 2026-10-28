from django.db import models

# Imágenes fijas del sitio que el administrador sube desde su panel.
# clave -> descripción que ve el administrador. Las plantillas las usan como img.<clave>
SLOTS_IMAGEN = {
    'hero_inicio': 'Inicio — foto de fondo principal (la grande de arriba)',
    'galeria_1': 'Inicio, galería — foto grande',
    'galeria_2': 'Inicio, galería — foto 2',
    'galeria_3': 'Inicio, galería — foto 3',
    'galeria_4': 'Inicio, galería — foto 4',
    'galeria_5': 'Inicio, galería — foto 5',
    'servicios_hero_1': 'Servicios, portada — foto 1 (arriba izquierda)',
    'servicios_hero_2': 'Servicios, portada — foto 2 (arriba centro)',
    'servicios_hero_3': 'Servicios, portada — foto 3 (arriba derecha)',
    'servicios_hero_4': 'Servicios, portada — foto 4 (abajo izquierda)',
    'servicios_hero_5': 'Servicios, portada — foto 5 (abajo centro)',
    'servicios_hero_6': 'Servicios, portada — foto 6 (abajo derecha)',
    'servicios_paso_1': 'Servicios, "Así empezamos" — paso 01',
    'servicios_paso_2': 'Servicios, "Así empezamos" — paso 02',
    'servicios_paso_3': 'Servicios, "Así empezamos" — paso 03',
    'tienda_banner': 'Tienda — banner principal',
    'nosotros_principal': 'Nosotros — foto principal',
    'nosotros_historia': 'Nosotros — foto de nuestra historia',
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