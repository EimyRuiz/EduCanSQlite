from rest_framework import serializers
from .models import Producto


def sin_etiquetas(valor):
    """Rechaza los símbolos < y >, que se usan para colar código en los textos."""
    if '<' in valor or '>' in valor:
        raise serializers.ValidationError('No uses los símbolos < o > en este campo.')
    return valor


class ProductSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=100, validators=[sin_etiquetas])
    categoria = serializers.ChoiceField(choices=Producto.OPCIONES_CATEGORIA)
    descripcion = serializers.CharField(validators=[sin_etiquetas])
    precio = serializers.FloatField(min_value=0)
    # El stock inicial solo se usa al CREAR. Después cambia con las compras y con "agregar unidades".
    # La imagen NO va aquí: se sube aparte, como archivo (/api/products/<id>/imagen/).
    stock = serializers.IntegerField(min_value=0, required=False)