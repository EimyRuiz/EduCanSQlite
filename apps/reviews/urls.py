from django.urls import path
from .views import ResenaListCreateView, ResponderResenaView, EstadisticasView

urlpatterns = [
    path('', ResenaListCreateView.as_view(), name='resena-list'),
    path('<int:pk>/responder/', ResponderResenaView.as_view(), name='resena-responder'),
    path('estadisticas/', EstadisticasView.as_view(), name='estadisticas'),
]