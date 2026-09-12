from django.db import models
from apps.users.models import Usuario


class Mascota(models.Model):
    SEXOS = [('macho', 'Macho'), ('hembra', 'Hembra')]

    dueno = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='mascotas')
    nombre = models.CharField(max_length=100)
    raza = models.CharField(max_length=100)
    edad = models.IntegerField()
    peso = models.FloatField()
    sexo = models.CharField(max_length=10, choices=SEXOS)
    esterilizado = models.BooleanField()
    vacunas_al_dia = models.BooleanField()
    conducta = models.TextField(blank=True, default='')
    salud = models.TextField(blank=True, default='')
    foto = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self):
        return f"{self.nombre} ({self.dueno.email})"