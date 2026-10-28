from django.urls import path
from .views import ResenaListCreateView, ResponderResenaView, EstadisticasView, MisResenasView

urlpatterns = [
    path('', ResenaListCreateView.as_view()),
    path('estadisticas/', EstadisticasView.as_view()),
    path('mias/', MisResenasView.as_view()),                    # reseñas del adiestrador logueado
    path('<int:pk>/responder/', ResponderResenaView.as_view()),
]