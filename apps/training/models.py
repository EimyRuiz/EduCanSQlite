from django.db import models


class Servicio(models.Model):
    OPCIONES_SERVICIO = [
        ('Adiestramiento básico', 'Adiestramiento básico'),
        ('Cachorros y socialización', 'Cachorros y socialización'),
        ('Modificación de conducta', 'Modificación de conducta'),
        ('Ansiedad por separación', 'Ansiedad por separación'),
        ('Entrenamiento avanzado', 'Entrenamiento avanzado'),
        ('Agility y deportes caninos', 'Agility y deportes caninos'),
        ('Paseos y ejercicio', 'Paseos y ejercicio'),
    ]

    nombre = models.CharField(max_length=100, choices=OPCIONES_SERVICIO)
    descripcion = models.TextField()
    precio = models.FloatField()
    imagen = models.URLField(blank=True, null=True)

    def __str__(self):
        return self.nombre