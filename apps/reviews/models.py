from django.db import models
from apps.users.models import Usuario
from apps.requests.models import Solicitud


class Resena(models.Model):
    cliente = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='resenas')
    solicitud = models.OneToOneField(Solicitud, on_delete=models.CASCADE, related_name='resena')
    estrellas = models.IntegerField()
    comentario = models.TextField(blank=True, default='')
    respuesta_admin = models.TextField(blank=True, default='')
    creado_en = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.estrellas}★ — {self.cliente.email}"