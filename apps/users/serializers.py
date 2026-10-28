from rest_framework import serializers


class UserRegisterSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=100)
    apellido = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    telefono = serializers.CharField(max_length=20)
    ciudad = serializers.CharField(max_length=100, required=False, default='')
    password = serializers.CharField(write_only=True)
    rol = serializers.ChoiceField(choices=['cliente', 'adiestrador'], default='cliente')
    especialidades_solicitadas = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )

    def validate_password(self, value):
        """Misma política del formulario: mínimo 8, una mayúscula, una minúscula y un número."""
        if len(value) < 8 or not (
            any(c.isupper() for c in value)
            and any(c.islower() for c in value)
            and any(c.isdigit() for c in value)
        ):
            raise serializers.ValidationError(
                'La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula y un número.'
            )
        # bcrypt solo admite hasta 72 bytes; más que eso daría un error al guardar
        if len(value.encode('utf-8')) > 72:
            raise serializers.ValidationError('La contraseña es demasiado larga (máximo 72 caracteres).')
        return value


class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)