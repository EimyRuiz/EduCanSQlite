from django.db import models
from apps.users.models import Usuario
from apps.requests.models import Solicitud


class Resena(models.Model):
    cliente = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='resenas')
    solicitud = models.OneToOneField(Solicitud, on_delete=models.CASCADE, related_name='resena')
    estrellas = models.IntegerField()
    comentario = models.TextField(blank=True, default='')

    # La respuesta puede escribirla el administrador o el adiestrador de ese servicio
    # (el campo conserva el nombre antiguo "respuesta_admin" para no romper datos existentes).
    respuesta_admin = models.TextField(blank=True, default='')
    # Quién escribió la respuesta (vacío en respuestas antiguas = se muestra como EDUCAN)
    respondido_por = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='resenas_respondidas'
    )
    creado_en = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.estrellas}★ — {self.cliente.email}"