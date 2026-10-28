from django.db import transaction
from django.db.models import F
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from apps.core.authentication import IsMongoAuthenticated
from .models import Producto, Pedido, PedidoItem

ESTADOS_VALIDOS = [e[0] for e in Pedido.ESTADOS]
MAX_POR_PRODUCTO = 20


def serialize_pedido(p):
    items = [{
        'nombre': i.nombre,
        'precio_unitario': i.precio_unitario,
        'cantidad': i.cantidad,
        'subtotal': i.precio_unitario * i.cantidad,
    } for i in p.items.all()]
    return {
        'id': p.id,
        'estado': p.estado,
        'cliente_nombre': f"{p.cliente.nombre} {p.cliente.apellido}",
        'cliente_email': p.cliente.email,
        'direccion': p.direccion,
        'ciudad': p.ciudad,
        'telefono': p.telefono,
        'notas': p.notas,
        'total': p.total,
        'items': items,
        'creado_en': p.creado_en.isoformat(),
    }


def reponer_stock(pedido):
    """Devuelve al inventario las unidades de un pedido cancelado."""
    for item in pedido.items.all():
        if item.producto_id:
            Producto.objects.filter(id=item.producto_id).update(stock=F('stock') + item.cantidad)


class PedidoListCreateView(APIView):
    permission_classes = [IsMongoAuthenticated]

    def get(self, request):
        rol = request.user.get('rol')
        pedidos = Pedido.objects.select_related('cliente').prefetch_related('items').order_by('-creado_en')

        if rol == 'administrador':
            pass                                                   # ve todos
        elif rol == 'cliente':
            pedidos = pedidos.filter(cliente_id=request.user.get('user_id'))   # solo los suyos
        else:
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        return Response([serialize_pedido(p) for p in pedidos])

    def post(self, request):
        if request.user.get('rol') != 'cliente':
            return Response({'error': 'Solo las cuentas de cliente pueden comprar.'},
                            status=status.HTTP_403_FORBIDDEN)

        datos = request.data
        direccion = str(datos.get('direccion', '')).strip()
        ciudad = str(datos.get('ciudad', '')).strip()
        telefono = str(datos.get('telefono', '')).strip()
        notas = str(datos.get('notas', '')).strip()

        if len(direccion) < 5 or len(direccion) > 200:
            return Response({'error': 'Escribe una dirección de entrega válida.'}, status=status.HTTP_400_BAD_REQUEST)
        if not ciudad or len(ciudad) > 100:
            return Response({'error': 'Escribe la ciudad de entrega.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(telefono) < 7 or len(telefono) > 20:
            return Response({'error': 'Escribe un teléfono de contacto válido.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(notas) > 500:
            return Response({'error': 'Las notas no pueden superar 500 caracteres.'}, status=status.HTTP_400_BAD_REQUEST)

        # Normaliza el carrito: {producto_id: cantidad}, sumando líneas repetidas
        items_recibidos = datos.get('items')
        if not isinstance(items_recibidos, list) or not items_recibidos:
            return Response({'error': 'Tu carrito está vacío.'}, status=status.HTTP_400_BAD_REQUEST)

        cantidades = {}
        for it in items_recibidos:
            try:
                pid = int(it.get('producto_id'))
                cant = int(it.get('cantidad'))
            except (TypeError, ValueError, AttributeError):
                return Response({'error': 'El carrito tiene datos no válidos.'}, status=status.HTTP_400_BAD_REQUEST)
            if cant < 1 or cant > MAX_POR_PRODUCTO:
                return Response({'error': f'La cantidad por producto debe estar entre 1 y {MAX_POR_PRODUCTO}.'},
                                status=status.HTTP_400_BAD_REQUEST)
            cantidades[pid] = cantidades.get(pid, 0) + cant

        # Todo o nada: si algo falla, no se descuenta ni se crea nada
        with transaction.atomic():
            productos = {p.id: p for p in Producto.objects.select_for_update().filter(id__in=cantidades.keys())}

            # 1) Validar existencia y stock con los datos reales de la base de datos
            for pid, cant in cantidades.items():
                p = productos.get(pid)
                if not p:
                    return Response({'error': 'Uno de los productos ya no está disponible.'},
                                    status=status.HTTP_400_BAD_REQUEST)
                if p.stock <= 0:
                    return Response({'error': f'"{p.nombre}" está agotado.'}, status=status.HTTP_400_BAD_REQUEST)
                if cant > p.stock:
                    return Response({'error': f'Solo quedan {p.stock} unidades de "{p.nombre}".'},
                                    status=status.HTTP_400_BAD_REQUEST)

            # 2) Crear el pedido, sus líneas y descontar el stock
            pedido = Pedido.objects.create(
                cliente_id=request.user.get('user_id'),
                direccion=direccion, ciudad=ciudad, telefono=telefono, notas=notas,
            )
            total = 0
            for pid, cant in cantidades.items():
                p = productos[pid]
                PedidoItem.objects.create(pedido=pedido, producto=p, nombre=p.nombre,
                                          precio_unitario=p.precio, cantidad=cant)
                p.stock -= cant
                p.save(update_fields=['stock'])
                total += p.precio * cant

            pedido.total = total      # el total lo calcula el servidor, nunca el navegador
            pedido.save(update_fields=['total'])

        return Response({'mensaje': 'Pedido realizado.', 'id': pedido.id, 'total': total},
                        status=status.HTTP_201_CREATED)


class PedidoDetailView(APIView):
    """Cambiar el estado de un pedido: solo el administrador."""
    permission_classes = [IsMongoAuthenticated]

    def patch(self, request, pk):
        if request.user.get('rol') != 'administrador':
            return Response({'error': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            pedido = Pedido.objects.prefetch_related('items').get(id=pk)
        except Pedido.DoesNotExist:
            return Response({'error': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        nuevo = request.data.get('estado')
        if nuevo not in ESTADOS_VALIDOS:
            return Response({'error': 'Estado no válido.'}, status=status.HTTP_400_BAD_REQUEST)
        if pedido.estado == 'cancelado' and nuevo != 'cancelado':
            return Response({'error': 'Un pedido cancelado no se puede reactivar.'},
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            if nuevo == 'cancelado' and pedido.estado != 'cancelado':
                reponer_stock(pedido)
            pedido.estado = nuevo
            pedido.save(update_fields=['estado'])

        return Response({'mensaje': 'Estado actualizado.'})


class PedidoCancelarView(APIView):
    """El cliente cancela uno de SUS pedidos mientras siga pendiente."""
    permission_classes = [IsMongoAuthenticated]

    def post(self, request, pk):
        try:
            pedido = Pedido.objects.prefetch_related('items').get(
                id=pk, cliente_id=request.user.get('user_id'))
        except Pedido.DoesNotExist:
            return Response({'error': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        if pedido.estado != 'pendiente':
            return Response({'error': 'Solo se pueden cancelar pedidos pendientes.'},
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            reponer_stock(pedido)
            pedido.estado = 'cancelado'
            pedido.save(update_fields=['estado'])

        return Response({'mensaje': 'Pedido cancelado.'})