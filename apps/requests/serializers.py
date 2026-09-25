from rest_framework import serializers


class ServiceRequestSerializer(serializers.Serializer):
    servicio = serializers.CharField(max_length=100)
    duracion = serializers.ChoiceField(choices=['corto', 'mediano', 'largo', 'muy_largo'])
    fecha_inicio = serializers.DateField()
    mascota_id = serializers.IntegerField()