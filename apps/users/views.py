import bcrypt
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.authentication import IsMongoAuthenticated
from .models import Usuario
from .serializers import UserRegisterSerializer, UserLoginSerializer


def serialize_usuario(u, incluir_password=False):
    data = {
        'id': str(u.id),
        'nombre': u.nombre,
        'apellido': u.apellido,
        'email': u.email,
        'telefono': u.telefono,
        'ciudad': u.ciudad,
        'rol': u.rol,
        'foto': u.foto,
        'estado_aprobacion': u.estado_aprobacion,
        'certificado': u.certificado,
        'especialidades_solicitadas': u.especialidades_solicitadas,
        'especialidades': u.especialidades,
    }
    if incluir_password:
        data['password'] = u.password
    return data


class RegisterView(APIView):
    def post(self, request):
        serializer = UserRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if Usuario.objects.filter(email=data['email']).exists():
            return Response({'error': 'Ya existe un usuario con ese email.'}, status=status.HTTP_400_BAD_REQUEST)

        password_hash = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        usuario = Usuario.objects.create(
            nombre=data['nombre'],
            apellido=data['apellido'],
            email=data['email'],
            telefono=data['telefono'],
            ciudad=data.get('ciudad', ''),
            password=password_hash,
            rol=data['rol'],
            estado_aprobacion='pendiente' if data['rol'] == 'adiestrador' else 'aprobado',
            especialidades_solicitadas=data.get('especialidades_solicitadas', []),
        )

        return Response(
            {'mensaje': 'Usuario registrado correctamente.', 'id': str(usuario.id), 'rol': usuario.rol},
            status=status.HTTP_201_CREATED
        )


class LoginView(APIView):
    def post(self, request):
        serializer = UserLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            usuario = Usuario.objects.get(email=data['email'])
        except Usuario.DoesNotExist:
            return Response({'error': 'Email o contraseña incorrectos.'}, status=status.HTTP_401_UNAUTHORIZED)

        if not bcrypt.checkpw(data['password'].encode('utf-8'), usuario.password.encode('utf-8')):
            return Response({'error': 'Email o contraseña incorrectos.'}, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken()
        refresh['user_id'] = str(usuario.id)
        refresh['email'] = usuario.email
        refresh['rol'] = usuario.rol

        return Response({
            'mensaje': 'Login exitoso.',
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'usuario': {'id': str(usuario.id), 'nombre': usuario.nombre, 'email': usuario.email, 'rol': usuario.rol},
        })


class MeView(APIView):
    permission_classes = [IsMongoAuthenticated]

    def get(self, request):
        usuario = Usuario.objects.get(id=request.user.get('user_id'))
        return Response(serialize_usuario(usuario))

    def patch(self, request):
        usuario = Usuario.objects.get(id=request.user.get('user_id'))
        for campo in ['nombre', 'apellido', 'telefono', 'ciudad']:
            if campo in request.data:
                setattr(usuario, campo, request.data[campo])
        usuario.save()
        return Response({'mensaje': 'Datos actualizados.'})


class UserListView(APIView):
    permission_classes = [IsMongoAuthenticated]

    def get(self, request):
        if request.user.get('rol') != 'administrador':
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        usuarios = Usuario.objects.all()
        return Response([serialize_usuario(u) for u in usuarios])


class UploadPhotoView(APIView):
    permission_classes = [IsMongoAuthenticated]

    def post(self, request):
        import os
        from django.conf import settings
        from django.core.files.storage import FileSystemStorage

        archivo = request.FILES.get('foto')
        if not archivo:
            return Response({'error': 'No se envió ninguna imagen.'}, status=status.HTTP_400_BAD_REQUEST)

        user_id = request.user.get('user_id')
        carpeta = os.path.join(settings.MEDIA_ROOT, 'perfiles')
        os.makedirs(carpeta, exist_ok=True)
        nombre_archivo = f"{user_id}_{archivo.name}"
        FileSystemStorage(location=carpeta).save(nombre_archivo, archivo)
        url_foto = f"{settings.MEDIA_URL}perfiles/{nombre_archivo}"

        usuario = Usuario.objects.get(id=user_id)
        usuario.foto = url_foto
        usuario.save()

        return Response({'mensaje': 'Foto actualizada.', 'foto': url_foto})


class UploadCertificadoView(APIView):
    permission_classes = [IsMongoAuthenticated]

    def post(self, request):
        import os
        from django.conf import settings
        from django.core.files.storage import FileSystemStorage

        archivo = request.FILES.get('certificado')
        if not archivo:
            return Response({'error': 'No se envió ningún archivo.'}, status=status.HTTP_400_BAD_REQUEST)

        user_id = request.user.get('user_id')
        carpeta = os.path.join(settings.MEDIA_ROOT, 'certificados')
        os.makedirs(carpeta, exist_ok=True)
        nombre_archivo = f"{user_id}_{archivo.name}"
        FileSystemStorage(location=carpeta).save(nombre_archivo, archivo)
        url_certificado = f"{settings.MEDIA_URL}certificados/{nombre_archivo}"

        usuario = Usuario.objects.get(id=user_id)
        usuario.certificado = url_certificado
        usuario.save()

        return Response({'mensaje': 'Certificado subido. Queda pendiente de revisión.', 'certificado': url_certificado})


class AprobarAdiestradorView(APIView):
    permission_classes = [IsMongoAuthenticated]

    def post(self, request, pk):
        if request.user.get('rol') != 'administrador':
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        accion = request.data.get('accion')
        usuario = Usuario.objects.get(id=pk)

        usuario.estado_aprobacion = 'aprobado' if accion == 'aprobar' else 'rechazado'
        if accion == 'aprobar':
            usuario.especialidades = usuario.especialidades_solicitadas
        usuario.save()

        return Response({'mensaje': f'Adiestrador {usuario.estado_aprobacion}.'})