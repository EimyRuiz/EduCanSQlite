"""
apps/community/models.py
Blog de la comunidad EDUCAN: publicaciones, comentarios, "me gusta", seguidores y cuentas suspendidas.
"""
from django.db import models
from django.utils import timezone

from apps.users.models import Usuario

# Estado de una publicación o comentario:
#   publicado -> lo ve todo el mundo
#   bloqueado -> el filtro de palabras lo detuvo; espera la revisión del administrador (nadie más lo ve)
#   rechazado -> el administrador confirmó que es inapropiado (queda guardado como evidencia, oculto)
ESTADOS = [
    ('publicado', 'Publicado'),
    ('bloqueado', 'Bloqueado por revisar'),
    ('rechazado', 'Rechazado'),
]


class Publicacion(models.Model):
    autor = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='publicaciones')
    texto = models.TextField(max_length=1000)
    imagen = models.CharField(max_length=300, blank=True, default='')      # ruta /media/comunidad/...
    estado = models.CharField(max_length=10, choices=ESTADOS, default='publicado')
    palabra_detectada = models.CharField(max_length=60, blank=True, default='')
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-creado_en']

    def __str__(self):
        return f"Publicación {self.id} de {self.autor_id}"


class Comentario(models.Model):
    publicacion = models.ForeignKey(Publicacion, on_delete=models.CASCADE, related_name='comentarios')
    autor = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='comentarios_comunidad')
    texto = models.TextField(max_length=500)
    estado = models.CharField(max_length=10, choices=ESTADOS, default='publicado')
    palabra_detectada = models.CharField(max_length=60, blank=True, default='')
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['creado_en']

    def __str__(self):
        return f"Comentario {self.id}"


class Like(models.Model):
    publicacion = models.ForeignKey(Publicacion, on_delete=models.CASCADE, related_name='likes')
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='likes_comunidad')
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('publicacion', 'usuario')     # un usuario solo puede dar un "me gusta" por publicación


class Seguimiento(models.Model):
    seguidor = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='siguiendo')
    seguido = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='seguidores')
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('seguidor', 'seguido')


class Restriccion(models.Model):
    """Cuenta suspendida (por días) o desactivada por el administrador (sin fecha de fin)."""
    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE, related_name='restriccion')
    hasta = models.DateTimeField(null=True, blank=True)       # vacío = hasta que el administrador la reactive
    motivo = models.CharField(max_length=200)
    origen = models.CharField(max_length=40, default='admin')  # "comentario:12", "publicacion:3" o "admin"
    creada_en = models.DateTimeField(auto_now_add=True)

    @property
    def activa(self):
        return self.hasta is None or self.hasta > timezone.now()