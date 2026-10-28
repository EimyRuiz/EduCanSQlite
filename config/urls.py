from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from django.conf import settings
from django.conf.urls.static import static

from apps.core.media_views import (
    ProductoImagenView, ServicioImagenView, ImagenSitioListView, ImagenSitioView,
)
from apps.pages.api import ContactoView, ContactoLeidoView
from apps.shop.orders import PedidoListCreateView, PedidoDetailView, PedidoCancelarView
from apps.shop.views import ProductoStockView

urlpatterns = [
    path('admin/', admin.site.urls),
    # "Mis pedidos" ahora vive dentro del panel del cliente; esta dirección vieja lo lleva allá
    path('mis-pedidos/', RedirectView.as_view(url='/mi-perfil/#pedidos')),
    path('', include('apps.pages.urls')),
    path('api/users/', include('apps.users.urls')),

    # Subida de imágenes y stock (van ANTES de los include de services/products)
    path('api/services/<int:pk>/imagen/', ServicioImagenView.as_view()),
    path('api/products/<int:pk>/imagen/', ProductoImagenView.as_view()),
    path('api/products/<int:pk>/stock/', ProductoStockView.as_view()),
    path('api/site-images/', ImagenSitioListView.as_view()),
    path('api/site-images/<str:clave>/', ImagenSitioView.as_view()),

    path('api/services/', include('apps.training.urls')),
    path('api/products/', include('apps.shop.urls')),
    path('api/orders/', PedidoListCreateView.as_view()),
    path('api/orders/<int:pk>/', PedidoDetailView.as_view()),
    path('api/orders/<int:pk>/cancelar/', PedidoCancelarView.as_view()),
    path('api/requests/', include('apps.requests.urls')),
    path('api/pets/', include('apps.pets.urls')),
    path('api/reviews/', include('apps.reviews.urls')),
    path('api/contact/', ContactoView.as_view()),
    path('api/contact/<int:pk>/leido/', ContactoLeidoView.as_view()),
]


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)