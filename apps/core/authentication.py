from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework.permissions import BasePermission, SAFE_METHODS


class MongoJWTAuthentication(JWTAuthentication):
    # Devuelve el contenido del token (diccionario) como "usuario".
    def get_user(self, validated_token):
        return validated_token.payload

    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except (InvalidToken, TokenError):
            return None


class IsMongoAuthenticated(BasePermission):
    # Permite el acceso a cualquier usuario con un token válido.
    def has_permission(self, request, view):
        return isinstance(request.user, dict)


class IsAdminRole(BasePermission):
    # Solo el administrador.
    def has_permission(self, request, view):
        return isinstance(request.user, dict) and request.user.get('rol') == 'administrador'


class AdminWriteOrReadOnly(BasePermission):
    """
    Lectura (GET) pública, para que el Inicio, Servicios y Tienda
    funcionen sin iniciar sesión. Crear, editar y borrar: solo el administrador.
    """
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return isinstance(request.user, dict) and request.user.get('rol') == 'administrador'