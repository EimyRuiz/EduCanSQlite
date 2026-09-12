from django.db import models


class Usuario(models.Model):
    ROLES = [
        ('cliente', 'Cliente'),
        ('adiestrador', 'Adiestrador'),
        ('administrador', 'Administrador'),
    ]
    ESTADOS = [
        ('pendiente', 'Pendiente'),
        ('aprobado', 'Aprobado'),
        ('rechazado', 'Rechazado'),
    ]

    nombre = models.CharField(max_length=100)
    apellido = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    telefono = models.CharField(max_length=20)
    ciudad = models.CharField(max_length=100, blank=True, default='')
    password = models.CharField(max_length=255)  # se guarda ya hasheada
    rol = models.CharField(max_length=20, choices=ROLES, default='cliente')
    foto = models.CharField(max_length=255, null=True, blank=True)

    # Solo aplican si rol == 'adiestrador'
    estado_aprobacion = models.CharField(max_length=20, choices=ESTADOS, default='aprobado')
    certificado = models.CharField(max_length=255, null=True, blank=True)
    especialidades_solicitadas = models.JSONField(default=list, blank=True)
    especialidades = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"{self.nombre} {self.apellido} ({self.email})"