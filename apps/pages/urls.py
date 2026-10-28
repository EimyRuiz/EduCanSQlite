from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('services/', views.services, name='services'),
    path('shop/', views.shop, name='shop'),
    path('admin-panel/', views.admin_panel, name='admin-panel'),
    path('solicitar-servicio/', views.request_service, name='request_service'),
    path('panel-adiestrador/', views.trainer_panel, name='trainer_panel'),
    path('mi-perfil/', views.my_profile, name='my_profile'),
    path('nosotros/', views.about, name='about'),
    path('contacto/', views.contact, name='contact'),
    path('blog/', views.maintenance, {'section': 'Blog'}, name='blog'),
    path('terminos/', views.maintenance, {'section': 'Términos de Servicio'}, name='terms'),
    path('privacidad/', views.maintenance, {'section': 'Política de Privacidad'}, name='privacy'),
]