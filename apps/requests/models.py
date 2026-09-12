from django.db import models
from apps.users.models import Usuario


class Solicitud(models.Model):
    DURACIONES = [
        ('corto', 'Corto plazo (menos de 1 mes)'),
        ('mediano', 'Mediano plazo (1 a 6 meses)'),
        ('largo', 'Largo plazo (6 meses a 1 año)'),
        ('muy_largo', 'Muy largo plazo (más de 1 año)'),
    ]
    ESTADOS = [
        ('pendiente', 'Pendiente'),
        ('aceptada', 'Aceptada'),
        ('rechazada', 'Rechazada'),
    ]
    SEXOS = [('macho', 'Macho'), ('hembra', 'Hembra')]

    servicio = models.CharField(max_length=100)
    duracion = models.CharField(max_length=20, choices=DURACIONES)
    fecha_inicio = models.DateField()

    cliente = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='solicitudes_como_cliente')
    adiestrador = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='solicitudes_como_adiestrador'
    )
    estado = models.CharField(max_length=20, choices=ESTADOS, default='pendiente')

    perro_nombre = models.CharField(max_length=100)
    perro_raza = models.CharField(max_length=100)
    perro_edad = models.IntegerField()
    perro_peso = models.FloatField()
    perro_sexo = models.CharField(max_length=10, choices=SEXOS)
    perro_esterilizado = models.BooleanField()
    perro_vacunas_al_dia = models.BooleanField()
    perro_conducta = models.TextField(blank=True, default='')
    perro_salud = models.TextField(blank=True, default='')
    perro_foto = models.CharField(max_length=255, null=True, blank=True)

    creado_en = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.servicio} — {self.perro_nombre} ({self.estado})"