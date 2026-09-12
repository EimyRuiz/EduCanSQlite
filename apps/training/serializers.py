from rest_framework import serializers


class ServiceSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=100)
    descripcion = serializers.CharField()
    precio = serializers.FloatField()
    imagen = serializers.URLField(required=False, allow_blank=True)