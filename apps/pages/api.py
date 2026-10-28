"""
apps/pages/api.py
API del formulario de contacto.
  POST /api/contact/              cualquier visitante envía un mensaje
  GET  /api/contact/              el administrador ve los mensajes
  POST /api/contact/<id>/leido/   el administrador marca un mensaje como leído
"""
import re
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from apps.core.authentication import IsAdminRole
from .models import Mensaje

EMAIL_VALIDO = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
MOTIVOS_VALIDOS = [m[0] for m in Mensaje.MOTIVOS]


class ContactoView(APIView):
    def get_permissions(self):
        # Enviar un mensaje es público; verlos es solo del administrador
        return [AllowAny()] if self.request.method == 'POST' else [IsAdminRole()]

    def post(self, request):
        datos = request.data

        # Campo trampa para robots: una persona real nunca lo ve ni lo llena
        if str(datos.get('website', '')).strip():
            return Response({'mensaje': 'Mensaje enviado.'}, status=status.HTTP_201_CREATED)

        nombre = str(datos.get('nombre', '')).strip()
        email = str(datos.get('email', '')).strip()
        telefono = str(datos.get('telefono', '')).strip()
        motivo = str(datos.get('motivo', 'otro')).strip()
        texto = str(datos.get('mensaje', '')).strip()

        if len(nombre) < 2 or len(nombre) > 100:
            return Response({'error': 'Escribe tu nombre.'}, status=status.HTTP_400_BAD_REQUEST)
        if not EMAIL_VALIDO.match(email) or len(email) > 254:
            return Response({'error': 'Escribe un correo electrónico válido.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(telefono) > 20:
            return Response({'error': 'El teléfono es demasiado largo.'}, status=status.HTTP_400_BAD_REQUEST)
        if motivo not in MOTIVOS_VALIDOS:
            motivo = 'otro'
        if len(texto) < 10:
            return Response({'error': 'Cuéntanos un poco más en tu mensaje (mínimo 10 caracteres).'},
                            status=status.HTTP_400_BAD_REQUEST)
        if len(texto) > 1500:
            return Response({'error': 'El mensaje no puede superar 1500 caracteres.'},
                            status=status.HTTP_400_BAD_REQUEST)

        Mensaje.objects.create(nombre=nombre, email=email, telefono=telefono, motivo=motivo, mensaje=texto)
        # Mañana: aquí mismo se agrega el envío del mensaje al correo de EDUCAN.
        return Response({'mensaje': 'Mensaje enviado.'}, status=status.HTTP_201_CREATED)

    def get(self, request):
        return Response([{
            'id': m.id,
            'nombre': m.nombre,
            'email': m.email,
            'telefono': m.telefono,
            'motivo': m.motivo,
            'motivo_texto': m.get_motivo_display(),
            'mensaje': m.mensaje,
            'leido': m.leido,
            'creado_en': m.creado_en.isoformat(),
        } for m in Mensaje.objects.all().order_by('-creado_en')])


class ContactoLeidoView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        actualizados = Mensaje.objects.filter(id=pk).update(leido=True)
        if not actualizados:
            return Response({'error': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'mensaje': 'Marcado como leído.'})