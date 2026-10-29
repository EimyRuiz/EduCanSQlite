"""
apps/community/admin_users.py
Lista de usuarios para el panel del administrador y botón "Eliminar usuario".

Solo administrador:
  GET    /api/community/moderation/usuarios/                lista completa con su estado (activo / inactivo)
  DELETE /api/community/moderation/users/<id>/eliminar/     elimina la cuenta (no se puede con administradores)
"""
from django.db import transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.authentication import IsAdminRole
from apps.core.media_files import borrar_archivo
from apps.users.models import Usuario
from .models import Restriccion


class AdminUsuariosView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        restricciones = {r.usuario_id: r for r in Restriccion.objects.all()}
        datos = []
        for u in Usuario.objects.all().order_by('-id'):       # los más nuevos primero
            r = restricciones.get(u.id)
            inactivo = bool(r and r.activa)                    # suspendido o desactivado
            datos.append({
                'id': u.id,
                'nombre': u.nombre,
                'apellido': u.apellido,
                'email': u.email,
                'telefono': u.telefono,
                'ciudad': u.ciudad,
                'rol': u.rol,
                'foto': u.foto or '',
                'estado': 'inactivo' if inactivo else 'activo',
                'motivo_restriccion': r.motivo if inactivo else '',
                'estado_aprobacion': u.estado_aprobacion,
                'certificado': u.certificado or '',
                'especialidades_solicitadas': u.especialidades_solicitadas or [],
                'especialidades': u.especialidades or [],
                'creado_en': u.creado_en.isoformat() if u.creado_en else None,
            })
        return Response(datos)


class AdminUsuarioEliminarView(APIView):
    permission_classes = [IsAdminRole]

    def delete(self, request, pk):
        usuario = Usuario.objects.filter(id=pk).first()
        if not usuario:
            return Response({'error': 'Usuario no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        if usuario.rol == 'administrador':
            return Response({'error': 'No se puede eliminar a un administrador.'}, status=status.HTTP_400_BAD_REQUEST)

        nombre = f"{usuario.nombre} {usuario.apellido}".strip()
        foto = usuario.foto
        try:
            with transaction.atomic():
                usuario.delete()          # sus publicaciones, comentarios, pedidos, etc. se borran con él
        except Exception:
            return Response(
                {'error': 'No se pudo eliminar porque tiene información asociada. Mejor desactiva la cuenta.'},
                status=status.HTTP_409_CONFLICT)

        if foto:
            try:
                borrar_archivo(foto)
            except Exception:
                pass                       # si la foto ya no existía, no importa
        return Response({'mensaje': f'La cuenta de {nombre} fue eliminada.'})