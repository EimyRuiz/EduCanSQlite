from django.urls import path
from .views import PetListCreateView, PetDetailView, UploadPetFotoView

urlpatterns = [
    path('', PetListCreateView.as_view(), name='pet-list'),
    path('<str:pk>/', PetDetailView.as_view(), name='pet-detail'),
    path('<str:pk>/foto/', UploadPetFotoView.as_view(), name='pet-foto'),
]