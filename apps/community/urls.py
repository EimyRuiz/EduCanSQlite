from django.urls import path
from . import views, admin_users

urlpatterns = [
    path('me/', views.MeView.as_view()),
    path('posts/', views.PublicacionListCreateView.as_view()),
    path('posts/<int:pk>/', views.PublicacionDetailView.as_view()),
    path('posts/<int:pk>/like/', views.LikeView.as_view()),
    path('posts/<int:pk>/comments/', views.ComentarioListCreateView.as_view()),
    path('comments/<int:pk>/', views.ComentarioDetailView.as_view()),
    path('users/<int:pk>/follow/', views.SeguirView.as_view()),

    path('moderation/', views.ModeracionView.as_view()),
    path('moderation/resumen/', views.ModeracionResumenView.as_view()),
    path('moderation/comments/<int:pk>/', views.ModeracionComentarioView.as_view()),
    path('moderation/posts/<int:pk>/', views.ModeracionPublicacionView.as_view()),
    path('moderation/users/<int:pk>/', views.ModeracionUsuarioView.as_view()),

    # Panel del administrador: lista de usuarios y eliminar usuario
    path('moderation/usuarios/', admin_users.AdminUsuariosView.as_view()),
    path('moderation/users/<int:pk>/eliminar/', admin_users.AdminUsuarioEliminarView.as_view()),
]