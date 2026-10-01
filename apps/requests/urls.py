from django.urls import path
from .views import ServiceRequestListCreateView, ServiceRequestDetailView, UploadPerroFotoView, AceptarSolicitudView, CompletarSolicitudView

urlpatterns = [
    path('', ServiceRequestListCreateView.as_view(), name='request-list'),
    path('<str:pk>/', ServiceRequestDetailView.as_view(), name='request-detail'),
    path('<str:pk>/foto/', UploadPerroFotoView.as_view(), name='request-foto'),
    path('<str:pk>/aceptar/', AceptarSolicitudView.as_view(), name='request-aceptar'),
    path('<str:pk>/completar/', CompletarSolicitudView.as_view(), name='request-completar'),
]