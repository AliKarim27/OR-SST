from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health, name='health'),
    path('transcribe_extract/', views.transcribe_extract, name='transcribe_extract'),
    path('transcribe_only/', views.transcribe_only, name='transcribe_only'),
    path('save_output/', views.save_output, name='save_output'),
    path('save_labels/', views.save_labels, name='save_labels'),
    path('upload_audio/', views.upload_audio, name='upload_audio'),
    path('list_audio/', views.list_audio, name='list_audio'),
    path('get_audio/', views.get_audio, name='get_audio'),
    path('delete_audio/', views.delete_audio, name='delete_audio'),
    path('get_stt_info/', views.get_stt_info, name='get_stt_info'),
    path('get_stt_models/', views.get_stt_models, name='get_stt_models'),
    path('set_stt_model/', views.set_stt_model, name='set_stt_model'),
    path('create_stt_model/', views.create_stt_model, name='create_stt_model'),
    path('delete_stt_model/', views.delete_stt_model, name='delete_stt_model'),
    path('get_stt_types/', views.get_stt_types, name='get_stt_types'),
    path('validate_stt_model/', views.validate_stt_model, name='validate_stt_model'),
    
    # NER endpoints
    path('ner/extract/', views.ner_extract, name='ner_extract'),
    path('ner/models/', views.get_ner_models, name='get_ner_models'),
    path('ner/models/create/', views.create_ner_model, name='create_ner_model'),
    path('ner/models/delete/', views.delete_ner_model, name='delete_ner_model'),
    path('ner/data/', views.get_training_data, name='get_training_data'),
    path('ner/data/add/', views.add_training_entry, name='add_training_entry'),
    path('ner/data/update/', views.update_training_entry, name='update_training_entry'),
    path('ner/data/delete/', views.delete_training_entry, name='delete_training_entry'),
    path('ner/data/stats/', views.get_data_stats, name='get_data_stats'),
    path('ner/entity-types/', views.get_entity_types, name='get_entity_types'),
    path('ner/entity-types/add/', views.add_entity_type, name='add_entity_type'),
    path('ner/entity-types/delete/', views.delete_entity_type, name='delete_entity_type'),
    path('ner/available-tags/', views.get_available_tags, name='get_available_tags'),
    path('ner/training/start/', views.start_training, name='start_training'),
    path('ner/training/status/', views.get_training_status, name='get_training_status'),
    path('ner/training/stop/', views.stop_training, name='stop_training'),
]
