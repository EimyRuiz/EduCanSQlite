from django.db import models
from apps.users.models import Usuario

# Cuando un producto baja de esta cantidad, el panel del administrador muestra un aviso
STOCK_BAJO = 10


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
    # Ruta de la foto subida desde el panel (ej. /media/productos/3_ab12cd34ef56.jpg)
    imagen = models.URLField(blank=True, null=True)
    # Unidades disponibles. Baja sola con cada compra; el administrador solo suma cuando entra mercancía.
    stock = models.PositiveIntegerField(default=10)

    def __str__(self):
        return self.nombre


class Pedido(models.Model):
    ESTADOS = [
        ('pendiente', 'Pendiente'),
        ('confirmado', 'Confirmado'),
        ('enviado', 'Enviado'),
        ('entregado', 'Entregado'),
        ('cancelado', 'Cancelado'),
    ]

    cliente = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='pedidos')
    estado = models.CharField(max_length=20, choices=ESTADOS, default='pendiente')
    direccion = models.CharField(max_length=200)
    ciudad = models.CharField(max_length=100)
    telefono = models.CharField(max_length=20)
    notas = models.TextField(blank=True, default='')
    total = models.FloatField(default=0)
    creado_en = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Pedido #{self.id} — {self.cliente.email} ({self.estado})"


class PedidoItem(models.Model):
    """Cada línea guarda el nombre y el precio del momento de la compra,
    así el historial no cambia si luego se edita o se borra el producto."""
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name='items')
    producto = models.ForeignKey(Producto, on_delete=models.SET_NULL, null=True, blank=True)
    nombre = models.CharField(max_length=100)
    precio_unitario = models.FloatField()
    cantidad = models.PositiveIntegerField()

    def __str__(self):
        return f"{self.cantidad} × {self.nombre}"