from rest_framework import serializers


class PetSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=100)
    raza = serializers.CharField(max_length=100)
    edad = serializers.IntegerField()
    peso = serializers.FloatField()
    sexo = serializers.ChoiceField(choices=['macho', 'hembra'])
    esterilizado = serializers.BooleanField()
    vacunas_al_dia = serializers.BooleanField()
    conducta = serializers.CharField(allow_blank=True, required=False)
    salud = serializers.CharField(allow_blank=True, required=False)