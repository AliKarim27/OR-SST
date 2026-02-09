from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health, name='health'),
    path('transcribe_extract/', views.transcribe_extract, name='transcribe_extract'),
    path('save_output/', views.save_output, name='save_output'),
    path('save_labels/', views.save_labels, name='save_labels'),
    path('upload_audio/', views.upload_audio, name='upload_audio'),
    path('list_audio/', views.list_audio, name='list_audio'),
    path('get_audio/', views.get_audio, name='get_audio'),
    path('delete_audio/', views.delete_audio, name='delete_audio'),
    path('get_stt_info/', views.get_stt_info, name='get_stt_info'),
    path('get_stt_models/', views.get_stt_models, name='get_stt_models'),
    path('set_stt_model/', views.set_stt_model, name='set_stt_model'),
]
