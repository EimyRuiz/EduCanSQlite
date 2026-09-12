from django.db import models


class Producto(models.Model):
    OPCIONES_CATEGORIA = [
        ('Collar', 'Collar'),
        ('Pechera', 'Pechera'),
        ('Correa', 'Correa'),
        ('Impermeable', 'Impermeable'),
        ('Juguete', 'Juguete'),
        ('Comida', 'Comida'),
        ('Producto de aseo', 'Producto de aseo'),
        ('Accesorio', 'Accesorio'),
    ]

    nombre = models.CharField(max_length=100)
    categoria = models.CharField(max_length=50, choices=OPCIONES_CATEGORIA)
    descripcion = models.TextField()
    precio = models.FloatField()
    imagen = models.URLField(blank=True, null=True)

    def __str__(self):
        return self.nombre