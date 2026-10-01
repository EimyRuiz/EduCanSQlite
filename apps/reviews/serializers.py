from rest_framework import serializers


class ResenaSerializer(serializers.Serializer):
    solicitud_id = serializers.IntegerField()
    estrellas = serializers.IntegerField(min_value=1, max_value=5)
    comentario = serializers.CharField(allow_blank=True, required=False)