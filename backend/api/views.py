import json
import os
import tempfile
from datetime import datetime
from pathlib import Path
import sys
from typing import Any, Dict
import subprocess
import threading

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import STTModel, NERModel

import librosa
import numpy as np
import logging
import traceback

# Project root (workspace root)
# views.py is at <workspace>/backend/api/views.py
# parents[2] -> workspace root; parents[3] went one level too high.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
# Ensure workspace root is on sys.path so top-level packages like `stt` and
# `extractor` can be imported when running the Django backend from `backend/`.
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
MODEL_DIR = PROJECT_ROOT / 'models' / 'slot_model'
AUDIO_DIR = PROJECT_ROOT / 'data' / 'audio'
OUTPUTS_DIR = PROJECT_ROOT / 'data' / 'outputs'
LABELS_DIR = PROJECT_ROOT / 'data' / 'labels'
OUTPUTS_PATH = OUTPUTS_DIR / 'extracted.jsonl'
LABELS_PATH = LABELS_DIR / 'train.jsonl'
LABEL_MAP_PATH = PROJECT_ROOT / 'data' / 'label_map.json'

# Lazy imports for heavy models
_stt = None
_extractor = None

# Training state management
_training_process = None
_training_logs = []
_training_status = 'idle'  # idle, running, completed, failed

def _ensure_default_models():
    """Ensure default STT models exist in database"""
    try:
        if STTModel.objects.count() == 0:
            # Create default models
            default_models = [
                {'name': 'tiny', 'description': 'Fastest, lowest accuracy. Best for quick processing.'},
                {'name': 'base', 'description': 'Balanced speed and accuracy. Recommended default.', 'is_default': True, 'is_active': True},
                {'name': 'small', 'description': 'Better accuracy than base, slower processing.'},
                {'name': 'medium', 'description': 'High accuracy, significantly slower inference.'},
                {'name': 'large', 'description': 'Best accuracy, slowest inference. Requires more resources.'},
            ]
            for model_data in default_models:
                STTModel.objects.create(model_type='whisper', **model_data)
            logging.info('Default STT models created in database')
    except Exception as e:
        # Table might not exist yet if migrations haven't been run
        logging.warning(f'Could not ensure default models: {e}')


def _ensure_mono(y: np.ndarray) -> np.ndarray:
    if y.ndim == 1:
        return y
    return np.mean(y, axis=0)


def _load_stt():
    global _stt
    if _stt is None:
        try:
            from stt.factory import STTFactory
            
            # Get active model from database
            model_name = 'base'
            model_type = 'whisper'
            device = 'cpu'
            compute_type = 'int8'
            
            try:
                _ensure_default_models()
                active_model = STTModel.objects.filter(is_active=True).first()
                if not active_model:
                    active_model = STTModel.objects.filter(is_default=True).first()
                
                if not active_model:
                    active_model = STTModel.objects.first()
                
                if active_model:
                    model_name = active_model.name
                    model_type = active_model.model_type
                    device = active_model.device
                    compute_type = active_model.compute_type
            except Exception as db_error:
                logging.warning(f'Could not load model from database, using defaults: {db_error}')

            # Use factory to create STT instance with validation
            _stt = STTFactory.create(
                model_type=model_type,
                model_name=model_name,
                device=device,
                compute_type=compute_type
            )
            
            if _stt is None:
                raise RuntimeError(f"Failed to create STT model: {model_type}/{model_name}")
            
            logging.info(f'Loaded STT model: {model_type}/{model_name}')
        except Exception as e:
            logging.exception('Failed to load STT model')
            raise
    return _stt


def _load_extractor():
    global _extractor
    if _extractor is None:
        try:
            if MODEL_DIR.exists() and MODEL_DIR.is_dir():
                from extractor.model_infer import SlotFillingExtractor
                from extractor.base_ner import NERConfig

                config = NERConfig(
                    model_type="slot-filling",
                    model_dir=str(MODEL_DIR),
                    device="cpu"
                )
                _extractor = SlotFillingExtractor(config)
        except Exception:
            logging.exception('Failed to load extractor model')
            raise
    return _extractor


def _audio_bytes_to_sr_y(audio_bytes: bytes):
    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        y, sr = librosa.load(tmp_path, sr=None, mono=False)
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass

    y = _ensure_mono(np.asarray(y, dtype=np.float32))
    return sr, y


@csrf_exempt
def health(request):
    return JsonResponse({'status': 'ok'})


@csrf_exempt
def transcribe_extract(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    # Accept multipart form with `audio` file OR JSON body with `transcript`.
    transcript = ''
    json_out: Dict[str, Any] = {}

    try:
        if 'audio' in request.FILES:
            audio_file = request.FILES['audio']
            audio_bytes = audio_file.read()
            sr, y = _audio_bytes_to_sr_y(audio_bytes)
            stt = _load_stt()
            if stt is None:
                return JsonResponse({'error': 'STT backend not available'}, status=500)
            audio_16k = stt.preprocess((sr, y))
            if audio_16k is None:
                return JsonResponse({'error': 'Failed to preprocess audio'}, status=400)
            transcript = stt.transcribe(audio_16k, language='en').strip()
        else:
            # JSON body
            try:
                payload = json.loads(request.body.decode('utf-8') or '{}')
            except Exception:
                payload = {}
            transcript = payload.get('transcript', '').strip()

        if not transcript:
            return JsonResponse({'transcript': transcript, 'json': {}, 'status': '❌ Empty transcript'}, status=200)

        extractor = _load_extractor()
        if extractor is None:
            return JsonResponse({'transcript': transcript, 'json': {}, 'status': '⚠️ No trained NLP model found'}, status=200)

        out_json = extractor.extract(transcript)
        return JsonResponse({'transcript': transcript, 'json': out_json, 'status': '✅ Extracted JSON'}, status=200)

    except Exception as e:
        tb = traceback.format_exc()
        logging.error('transcribe_extract failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


@csrf_exempt
def save_output(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
        transcript = payload.get('transcript', '').strip()
        json_obj = payload.get('json', {})

        if not transcript:
            return JsonResponse({'error': 'transcript required'}, status=400)

        OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
        rec = {
            'timestamp': datetime.now().isoformat(timespec='seconds'),
            'transcript': transcript,
            'json': json_obj,
        }
        with open(OUTPUTS_PATH, 'a', encoding='utf-8') as f:
            f.write(json.dumps(rec, ensure_ascii=False) + '\n')

        return JsonResponse({'status': f'Saved to {str(OUTPUTS_PATH)}'})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def save_labels(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
        transcript = payload.get('transcript', '').strip()
        tags_str = payload.get('tags', '').strip()

        if not transcript:
            return JsonResponse({'error': 'transcript required'}, status=400)

        tokens = transcript.strip().split() if transcript else []
        tags = tags_str.split() if tags_str else []
        if len(tokens) != len(tags):
            return JsonResponse({'error': f'Invalid tags: provided {len(tags)} tags but {len(tokens)} tokens'}, status=400)

        LABELS_DIR.mkdir(parents=True, exist_ok=True)
        rec = {'tokens': tokens, 'tags': tags}
        with open(LABELS_PATH, 'a', encoding='utf-8') as f:
            f.write(json.dumps(rec, ensure_ascii=False) + '\n')

        return JsonResponse({'status': f'Added training example to {str(LABELS_PATH)}'})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# --- Audio storage endpoints ---
@csrf_exempt
def upload_audio(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    try:
        if 'audio' not in request.FILES:
            return JsonResponse({'error': 'audio file required'}, status=400)
        audio_file = request.FILES['audio']
        fname = request.POST.get('filename') or audio_file.name
        audio_dir = PROJECT_ROOT / 'data' / 'audio'
        audio_dir.mkdir(parents=True, exist_ok=True)
        dest = audio_dir / fname
        # prevent overwriting by adding suffix if exists
        base = dest.stem
        ext = dest.suffix
        i = 1
        while dest.exists():
            dest = audio_dir / f"{base}-{i}{ext}"
            i += 1
        with open(dest, 'wb') as f:
            for chunk in audio_file.chunks():
                f.write(chunk)
        return JsonResponse({'status': 'saved', 'name': dest.name})
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('upload_audio failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


def list_audio(request):
    try:
        from urllib.parse import quote
        import math
        
        # Get pagination parameters
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 5))
        
        audio_dir = PROJECT_ROOT / 'data' / 'audio'
        if not audio_dir.exists():
            return JsonResponse({
                'list': [],
                'pagination': {
                    'total': 0,
                    'total_pages': 0,
                    'current_page': page,
                    'page_size': page_size
                }
            })
        
        # Get all files sorted by modification time
        files = [p.name for p in sorted(audio_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True) if p.is_file()]
        total = len(files)
        total_pages = math.ceil(total / page_size) if page_size > 0 else 0
        
        # Calculate pagination slice
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_files = files[start_idx:end_idx]
        
        # Provide a URL pointing to the get_audio endpoint with proper URL encoding (without /api/ prefix)
        result = [{'name': n, 'url': f"/get_audio/?name={quote(n)}"} for n in paginated_files]
        
        return JsonResponse({
            'list': result,
            'pagination': {
                'total': total,
                'total_pages': total_pages,
                'current_page': page,
                'page_size': page_size
            }
        })
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('list_audio failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


def get_audio(request):
    try:
        import mimetypes
        name = request.GET.get('name')
        if not name:
            return JsonResponse({'error': 'name required'}, status=400)
        audio_path = PROJECT_ROOT / 'data' / 'audio' / name
        if not audio_path.exists() or not audio_path.is_file():
            return JsonResponse({'error': 'not found'}, status=404)
        
        # Detect content type based on file extension
        content_type, _ = mimetypes.guess_type(str(audio_path))
        if not content_type:
            content_type = 'audio/webm'  # Default for recordings
        
        from django.http import FileResponse
        return FileResponse(open(audio_path, 'rb'), content_type=content_type)
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('get_audio failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


@csrf_exempt
def delete_audio(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
        filename = payload.get('filename')
        if not filename:
            return JsonResponse({'error': 'filename required'}, status=400)
        audio_path = PROJECT_ROOT / 'data' / 'audio' / filename
        if not audio_path.exists() or not audio_path.is_file():
            return JsonResponse({'error': 'not found'}, status=404)
        audio_path.unlink()
        return JsonResponse({'status': 'deleted', 'name': filename})
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('delete_audio failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


# --- STT Model endpoints ---
def get_stt_models(request):
    """Get all STT models from database and current active model"""
    try:
        _ensure_default_models()
        models = STTModel.objects.all()
        active_model = STTModel.objects.filter(is_active=True).first()
        
        models_list = [{
            'id': m.id,
            'name': m.name,
            'model_type': m.model_type,
            'device': m.device,
            'compute_type': m.compute_type,
            'is_active': m.is_active,
            'is_default': m.is_default,
            'description': m.description,
            'created_at': m.created_at.isoformat() if m.created_at else None,
        } for m in models]
        
        return JsonResponse({
            'models': models_list,
            'current_model': active_model.name if active_model else 'base',
            'current_model_id': active_model.id if active_model else None,
        })
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('get_stt_models failed: %s', tb)
        # Return a helpful error message if migrations haven't been run
        if 'no such table' in str(e).lower():
            return JsonResponse({
                'error': 'Database not initialized. Please run: python manage.py migrate',
                'trace': tb
            }, status=500)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


@csrf_exempt
def set_stt_model(request):
    """Set the STT model as active"""
    global _stt
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
        model_id = payload.get('model_id')
        
        if not model_id:
            return JsonResponse({'error': 'model_id required'}, status=400)
        
        try:
            model = STTModel.objects.get(id=model_id)
        except STTModel.DoesNotExist:
            return JsonResponse({'error': 'Model not found'}, status=404)
        
        # Set as active (model.save() will handle deactivating others)
        model.is_active = True
        model.save()
        
        # Force reload of STT with new model
        _stt = None
        
        return JsonResponse({
            'status': f'STT model changed to {model.name}',
            'current_model': model.name,
            'current_model_id': model.id,
        })
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('set_stt_model failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


@csrf_exempt
def create_stt_model(request):
    """Create a new STT model configuration"""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
        
        name = payload.get('name', '').strip()
        model_type = payload.get('model_type', 'whisper').strip()
        device = payload.get('device', 'cpu').strip()
        compute_type = payload.get('compute_type', 'int8').strip()
        description = payload.get('description', '').strip()
        
        if not name:
            return JsonResponse({'error': 'name is required'}, status=400)
        
        # Check if model with same name exists
        if STTModel.objects.filter(name=name).exists():
            return JsonResponse({'error': f'Model with name "{name}" already exists'}, status=400)
        
        # Validate the model configuration before saving
        from stt.factory import STTFactory
        validation = STTFactory.validate_model(model_type, name, device, compute_type)
        
        if not validation['valid']:
            return JsonResponse({
                'error': f"Invalid model configuration: {validation['message']}"
            }, status=400)
        
        if not validation['available']:
            return JsonResponse({
                'error': f"Model not available: {validation['message']}"
            }, status=400)
        
        model = STTModel.objects.create(
            name=name,
            model_type=model_type,
            device=device,
            compute_type=compute_type,
            description=description,
            is_active=False,
            is_default=False,
        )
        
        response_data = {
            'status': 'Model created successfully',
            'model': {
                'id': model.id,
                'name': model.name,
                'model_type': model.model_type,
                'device': model.device,
                'compute_type': model.compute_type,
                'description': model.description,
            }
        }
        
        if validation.get('warnings'):
            response_data['warnings'] = validation['warnings']
        
        return JsonResponse(response_data)
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('create_stt_model failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


@csrf_exempt
def delete_stt_model(request):
    """Delete an STT model configuration"""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
        model_id = payload.get('model_id')
        
        if not model_id:
            return JsonResponse({'error': 'model_id required'}, status=400)
        
        try:
            model = STTModel.objects.get(id=model_id)
        except STTModel.DoesNotExist:
            return JsonResponse({'error': 'Model not found'}, status=404)
        
        # Prevent deleting active or default model
        if model.is_active:
            return JsonResponse({'error': 'Cannot delete the active model'}, status=400)
        
        if model.is_default:
            return JsonResponse({'error': 'Cannot delete the default model'}, status=400)
        
        model_name = model.name
        model.delete()
        
        return JsonResponse({
            'status': f'Model {model_name} deleted successfully'
        })
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('delete_stt_model failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


def get_stt_types(request):
    """Get available STT implementation types"""
    try:
        from stt.factory import STTFactory
        
        available_types = STTFactory.get_available_types()
        
        return JsonResponse({
            'types': available_types,
            'default_type': 'whisper'
        })
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('get_stt_types failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


@csrf_exempt
def validate_stt_model(request):
    """Validate an STT model configuration"""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    try:
        from stt.factory import STTFactory
        
        payload = json.loads(request.body.decode('utf-8') or '{}')
        model_type = payload.get('model_type', 'whisper')
        model_name = payload.get('model_name', 'base')
        device = payload.get('device', 'cpu')
        compute_type = payload.get('compute_type', 'int8')
        
        validation = STTFactory.validate_model(model_type, model_name, device, compute_type)
        
        return JsonResponse(validation)
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('validate_stt_model failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


@csrf_exempt
def transcribe_only(request):
    """Transcribe audio using active STT model (without extraction)"""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    
    try:
        # Accept audio file or filename
        if 'audio' in request.FILES:
            # Direct audio upload
            audio_file = request.FILES['audio']
            audio_bytes = audio_file.read()
        elif 'filename' in request.POST:
            # Load from server storage
            filename = request.POST['filename']
            audio_path = AUDIO_DIR / filename
            if not audio_path.exists():
                return JsonResponse({'error': 'Audio file not found'}, status=404)
            with open(audio_path, 'rb') as f:
                audio_bytes = f.read()
        else:
            return JsonResponse({'error': 'audio file or filename required'}, status=400)
        
        # Preprocess and transcribe
        sr, y = _audio_bytes_to_sr_y(audio_bytes)
        stt = _load_stt()
        if stt is None:
            return JsonResponse({'error': 'STT backend not available'}, status=500)
        
        audio_16k = stt.preprocess((sr, y))
        if audio_16k is None:
            return JsonResponse({'error': 'Failed to preprocess audio'}, status=400)
        
        transcript = stt.transcribe(audio_16k, language='en').strip()
        
        # Get active model info
        active_model = STTModel.objects.filter(is_active=True).first()
        model_info = {
            'name': active_model.name if active_model else 'base',
            'type': active_model.model_type if active_model else 'whisper',
            'device': active_model.device if active_model else 'cpu',
        }
        
        return JsonResponse({
            'transcript': transcript,
            'model_info': model_info,
            'status': 'success'
        }, status=200)
        
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('transcribe_only failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


@csrf_exempt
def get_stt_info(request):
    """Get current STT model info and available models"""
    try:
        available_models = ['tiny', 'base', 'small', 'medium', 'large']
        stt = _load_stt()
        current_model = 'base'  # default model name
        
        model_info = {
            'available_models': available_models,
            'current_model': current_model,
            'device': 'cpu',
            'compute_type': 'int8',
            'model_details': {
                'tiny': {'size': '39M', 'speed': 'Very Fast', 'accuracy': 'Good'},
                'base': {'size': '74M', 'speed': 'Fast', 'accuracy': 'Very Good'},
                'small': {'size': '244M', 'speed': 'Medium', 'accuracy': 'Excellent'},
                'medium': {'size': '769M', 'speed': 'Slow', 'accuracy': 'Excellent'},
                'large': {'size': '1.5B', 'speed': 'Very Slow', 'accuracy': 'Best'},
            }
        }
        return JsonResponse(model_info)
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('get_stt_info failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


# ============================================================================
# NER (Named Entity Recognition) API Endpoints
# ============================================================================

def _ensure_default_ner_models():
    """Ensure default NER model exists in database"""
    try:
        if NERModel.objects.count() == 0:
            default_model_path = str(MODEL_DIR)
            if MODEL_DIR.exists():
                NERModel.objects.create(
                    name='slot_model',
                    model_type='slot-filling',
                    model_path=default_model_path,
                    device='cpu',
                    is_active=True,
                    status='active',
                    description='Default slot-filling NER model using DistilBERT'
                )
                logging.info('Default NER model created in database')
    except Exception as e:
        logging.warning(f'Could not ensure default NER models: {e}')


def _get_model_size(model_path: str) -> str:
    """Calculate model directory size"""
    try:
        from pathlib import Path
        path = Path(model_path)
        if not path.exists():
            return '0 MB'
        
        total_size = sum(f.stat().st_size for f in path.rglob('*') if f.is_file())
        size_mb = total_size / (1024 * 1024)
        
        if size_mb < 1:
            return f'{total_size / 1024:.1f} KB'
        elif size_mb < 1024:
            return f'{size_mb:.0f} MB'
        else:
            return f'{size_mb / 1024:.2f} GB'
    except Exception:
        return '0 MB'


@csrf_exempt
def get_ner_models(request):
    """Get all NER models"""
    if request.method != 'GET':
        return JsonResponse({'error': 'GET required'}, status=405)
    
    try:
        _ensure_default_ner_models()
        models = NERModel.objects.all()
        
        models_data = []
        for model in models:
            models_data.append({
                'id': model.id,
                'name': model.name,
                'path': model.model_path,
                'type': model.model_type,
                'status': model.status,
                'device': model.device,
                'created': model.created_at.strftime('%Y-%m-%d'),
                'size': _get_model_size(model.model_path),
                'is_active': model.is_active,
                'description': model.description,
            })
        
        return JsonResponse({'models': models_data})
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('get_ner_models failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


@csrf_exempt
def ner_extract(request):
    """Extract entities from text using the active NER model"""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    
    try:
        data = json.loads(request.body)
        text = data.get('text', '').strip()
        
        if not text:
            return JsonResponse({'error': 'Text is required'}, status=400)
        
        extractor = _load_extractor()
        if extractor is None:
            return JsonResponse({
                'error': 'No trained NER model found',
                'text': text,
                'entities': {},
                'raw_entities': []
            }, status=200)
        
        # Get extracted entities
        extracted_json = extractor.extract(text)
        
        # Get raw entity predictions (if available)
        raw_entities = []
        try:
            if hasattr(extractor, 'predict_raw'):
                raw_entities = extractor.predict_raw(text)
            elif hasattr(extractor, 'pipe') and extractor.pipe is not None:
                raw_entities = extractor.pipe(text)
            
            # Convert numpy types to native Python types for JSON serialization
            if raw_entities:
                raw_entities = [
                    {
                        'entity': e.get('entity_group', e.get('entity', '')),
                        'word': e.get('word', ''),
                        'score': float(e.get('score', 0)),
                        'start': int(e.get('start', 0)),
                        'end': int(e.get('end', 0)),
                    }
                    for e in raw_entities
                ]
        except Exception as e:
            logging.warning(f'Could not get raw entities: {e}')
        
        # Get active NER model info
        _ensure_default_ner_models()
        active_model = NERModel.objects.filter(is_active=True).first()
        model_info = {
            'name': active_model.name if active_model else 'slot_model',
            'type': active_model.model_type if active_model else 'slot-filling',
            'device': active_model.device if active_model else 'cpu',
        }
        
        return JsonResponse({
            'text': text,
            'entities': extracted_json,
            'raw_entities': raw_entities,
            'model_info': model_info,
            'status': 'success'
        }, status=200)
        
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('ner_extract failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


@csrf_exempt
def create_ner_model(request):
    """Create a new NER model"""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    
    try:
        data = json.loads(request.body)
        name = data.get('name', '').strip()
        model_type = data.get('model_type', 'slot-filling')
        device = data.get('device', 'cpu')
        description = data.get('description', '')
        
        if not name:
            return JsonResponse({'error': 'Model name is required'}, status=400)
        
        # Check if model with same name already exists
        if NERModel.objects.filter(name=name).exists():
            return JsonResponse({'error': f'Model with name "{name}" already exists'}, status=400)
        
        # Create model directory path
        model_path = str(PROJECT_ROOT / 'models' / name)
        
        # Create model
        model = NERModel.objects.create(
            name=name,
            model_type=model_type,
            model_path=model_path,
            device=device,
            status='created',
            description=description
        )
        
        # Create directory if it doesn't exist
        Path(model_path).mkdir(parents=True, exist_ok=True)
        
        return JsonResponse({
            'success': True,
            'model': {
                'id': model.id,
                'name': model.name,
                'path': model.model_path,
                'type': model.model_type,
                'status': model.status,
                'created': model.created_at.strftime('%Y-%m-%d'),
            }
        })
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('create_ner_model failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


@csrf_exempt
def delete_ner_model(request):
    """Delete a NER model"""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    
    try:
        data = json.loads(request.body)
        model_id = data.get('id')
        
        if not model_id:
            return JsonResponse({'error': 'Model ID is required'}, status=400)
        
        model = NERModel.objects.get(id=model_id)
        
        if model.is_active:
            return JsonResponse({'error': 'Cannot delete active model'}, status=400)
        
        model_name = model.name
        model.delete()
        
        return JsonResponse({
            'success': True,
            'message': f'Model "{model_name}" deleted successfully'
        })
    except NERModel.DoesNotExist:
        return JsonResponse({'error': 'Model not found'}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('delete_ner_model failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


@csrf_exempt
def get_training_data(request):
    """Get training data from train.jsonl"""
    if request.method != 'GET':
        return JsonResponse({'error': 'GET required'}, status=405)
    
    try:
        if not LABELS_PATH.exists():
            return JsonResponse({'data': [], 'stats': {'totalEntries': 0, 'uniqueLabels': 0, 'avgTokens': 0}})
        
        data = []
        all_tags = []
        total_tokens = 0
        
        with open(LABELS_PATH, 'r', encoding='utf-8') as f:
            for idx, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                
                try:
                    entry = json.loads(line)
                    tokens = entry.get('tokens', [])
                    tags = entry.get('tags', [])
                    
                    data.append({
                        'id': idx,
                        'tokens': tokens,
                        'tags': tags
                    })
                    
                    all_tags.extend(tags)
                    total_tokens += len(tokens)
                except json.JSONDecodeError:
                    logging.warning(f'Invalid JSON on line {idx}')
                    continue
        
        # Calculate stats
        unique_labels = len(set(tag for tag in all_tags if tag != 'O'))
        avg_tokens = (total_tokens / len(data)) if data else 0
        
        stats = {
            'totalEntries': len(data),
            'uniqueLabels': unique_labels,
            'avgTokens': round(avg_tokens, 1)
        }
        
        return JsonResponse({'data': data, 'stats': stats})
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('get_training_data failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


@csrf_exempt
def add_training_entry(request):
    """Add a new training data entry"""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    
    try:
        data = json.loads(request.body)
        tokens = data.get('tokens', [])
        tags = data.get('tags', [])
        
        if not tokens or not tags:
            return JsonResponse({'error': 'Tokens and tags are required'}, status=400)
        
        if len(tokens) != len(tags):
            return JsonResponse({'error': 'Number of tokens must match number of tags'}, status=400)
        
        # Validate tags against entity types from label_map.json
        valid_tags = ['O']
        if LABEL_MAP_PATH.exists():
            with open(LABEL_MAP_PATH, 'r', encoding='utf-8') as f:
                valid_tags = json.load(f)
        
        invalid_tags = [tag for tag in tags if tag not in valid_tags]
        if invalid_tags:
            return JsonResponse({
                'error': f'Invalid tags: {", ".join(set(invalid_tags))}. Valid tags: {", ".join(valid_tags)}'
            }, status=400)
        
        # Create labels directory if it doesn't exist
        LABELS_DIR.mkdir(parents=True, exist_ok=True)
        
        # Append to train.jsonl
        entry = json.dumps({'tokens': tokens, 'tags': tags})
        with open(LABELS_PATH, 'a', encoding='utf-8') as f:
            f.write(entry + '\n')
        
        return JsonResponse({
            'success': True,
            'message': 'Entry added successfully'
        })
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('add_training_entry failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


@csrf_exempt
def update_training_entry(request):
    """Update an existing training data entry"""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    
    try:
        data = json.loads(request.body)
        entry_id = data.get('id')
        tokens = data.get('tokens', [])
        tags = data.get('tags', [])
        
        if not entry_id:
            return JsonResponse({'error': 'Entry ID is required'}, status=400)
        
        if not tokens or not tags:
            return JsonResponse({'error': 'Tokens and tags are required'}, status=400)
        
        if len(tokens) != len(tags):
            return JsonResponse({'error': 'Number of tokens must match number of tags'}, status=400)
        
        # Validate tags against entity types from label_map.json
        valid_tags = ['O']
        if LABEL_MAP_PATH.exists():
            with open(LABEL_MAP_PATH, 'r', encoding='utf-8') as f:
                valid_tags = json.load(f)
        
        invalid_tags = [tag for tag in tags if tag not in valid_tags]
        if invalid_tags:
            return JsonResponse({
                'error': f'Invalid tags: {", ".join(set(invalid_tags))}. Valid tags: {", ".join(valid_tags)}'
            }, status=400)
        
        if not LABELS_PATH.exists():
            return JsonResponse({'error': 'Training data file not found'}, status=404)
        
        # Read all entries
        entries = []
        with open(LABELS_PATH, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    entries.append(json.loads(line))
        
        # Update the specific entry (1-indexed)
        if entry_id < 1 or entry_id > len(entries):
            return JsonResponse({'error': 'Entry ID out of range'}, status=400)
        
        entries[entry_id - 1] = {'tokens': tokens, 'tags': tags}
        
        # Write back all entries
        with open(LABELS_PATH, 'w', encoding='utf-8') as f:
            for entry in entries:
                f.write(json.dumps(entry) + '\n')
        
        return JsonResponse({
            'success': True,
            'message': 'Entry updated successfully'
        })
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('update_training_entry failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


@csrf_exempt
def delete_training_entry(request):
    """Delete a training data entry"""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    
    try:
        data = json.loads(request.body)
        entry_id = data.get('id')
        
        if not entry_id:
            return JsonResponse({'error': 'Entry ID is required'}, status=400)
        
        if not LABELS_PATH.exists():
            return JsonResponse({'error': 'Training data file not found'}, status=404)
        
        # Read all entries
        entries = []
        with open(LABELS_PATH, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    entries.append(json.loads(line))
        
        # Delete the specific entry (1-indexed)
        if entry_id < 1 or entry_id > len(entries):
            return JsonResponse({'error': 'Entry ID out of range'}, status=400)
        
        entries.pop(entry_id - 1)
        
        # Write back remaining entries
        with open(LABELS_PATH, 'w', encoding='utf-8') as f:
            for entry in entries:
                f.write(json.dumps(entry) + '\n')
        
        return JsonResponse({
            'success': True,
            'message': 'Entry deleted successfully'
        })
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('delete_training_entry failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


@csrf_exempt
def get_data_stats(request):
    """Get training data statistics"""
    if request.method != 'GET':
        return JsonResponse({'error': 'GET required'}, status=405)
    
    try:
        if not LABELS_PATH.exists():
            return JsonResponse({
                'trainSamples': 0,
                'devSamples': 0,
                'totalLabels': 0
            })
        
        # Count train samples
        train_samples = 0
        with open(LABELS_PATH, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    train_samples += 1
        
        # Count dev samples if exists
        dev_samples = 0
        dev_path = LABELS_DIR / 'dev.jsonl'
        if dev_path.exists():
            with open(dev_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        dev_samples += 1
        
        # Count unique labels from label_map.json
        label_map_path = PROJECT_ROOT / 'data' / 'label_map.json'
        total_labels = 0
        if label_map_path.exists():
            with open(label_map_path, 'r', encoding='utf-8') as f:
                labels = json.load(f)
                total_labels = len([l for l in labels if l != 'O'])
        
        return JsonResponse({
            'trainSamples': train_samples,
            'devSamples': dev_samples,
            'totalLabels': total_labels
        })
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('get_data_stats failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


# ============================================================================
# Entity Type Management Endpoints
# ============================================================================

# Predefined colors for entity types (for consistent UI display)
ENTITY_TYPE_COLORS = [
    '#2196f3', '#4caf50', '#9c27b0', '#ff5722', '#e91e63',
    '#00bcd4', '#ff9800', '#795548', '#607d8b', '#673ab7',
    '#3f51b5', '#f44336', '#009688', '#8bc34a', '#ffc107',
    '#03a9f4', '#cddc39', '#ff5252', '#7c4dff', '#69f0ae',
]


def get_entity_types(request):
    """Get all entity types from label_map.json"""
    if request.method != 'GET':
        return JsonResponse({'error': 'GET required'}, status=405)
    
    try:
        if not LABEL_MAP_PATH.exists():
            return JsonResponse({
                'entity_types': [],
                'raw_labels': ['O'],
                'total': 0
            })
        
        with open(LABEL_MAP_PATH, 'r', encoding='utf-8') as f:
            labels = json.load(f)
        
        # Extract unique entity types (without B-/I- prefixes)
        entity_types = set()
        for label in labels:
            if label != 'O':
                # Remove B- or I- prefix
                entity_type = label[2:] if label.startswith(('B-', 'I-')) else label
                entity_types.add(entity_type)
        
        # Sort and assign colors
        entity_types_list = sorted(list(entity_types))
        entity_types_with_colors = []
        for idx, entity_type in enumerate(entity_types_list):
            color = ENTITY_TYPE_COLORS[idx % len(ENTITY_TYPE_COLORS)]
            entity_types_with_colors.append({
                'name': entity_type,
                'color': color,
                'b_label': f'B-{entity_type}',
                'i_label': f'I-{entity_type}',
            })
        
        return JsonResponse({
            'entity_types': entity_types_with_colors,
            'raw_labels': labels,
            'total': len(entity_types_list)
        })
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('get_entity_types failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


def get_available_tags(request):
    """Get all available BIO tags for training data annotation.
    Tags are derived from entity types in label_map.json.
    Returns O tag plus B-/I- tags for each entity type.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'GET required'}, status=405)
    
    try:
        if not LABEL_MAP_PATH.exists():
            return JsonResponse({
                'tags': ['O'],
                'entity_types': [],
                'tags_with_colors': [{'tag': 'O', 'color': '#9e9e9e', 'type': 'outside'}]
            })
        
        with open(LABEL_MAP_PATH, 'r', encoding='utf-8') as f:
            labels = json.load(f)
        
        # Build tags with colors and entity type info
        tags_with_colors = []
        entity_types = set()
        
        for label in labels:
            if label == 'O':
                tags_with_colors.append({
                    'tag': 'O',
                    'color': '#9e9e9e',
                    'type': 'outside'
                })
            else:
                # Extract entity type
                prefix = label[:2] if label.startswith(('B-', 'I-')) else ''
                entity_type = label[2:] if prefix else label
                entity_types.add(entity_type)
        
        # Sort entity types and assign colors
        sorted_entities = sorted(list(entity_types))
        entity_color_map = {}
        for idx, entity_type in enumerate(sorted_entities):
            entity_color_map[entity_type] = ENTITY_TYPE_COLORS[idx % len(ENTITY_TYPE_COLORS)]
        
        # Add B- and I- tags for each entity type
        for entity_type in sorted_entities:
            color = entity_color_map[entity_type]
            tags_with_colors.append({
                'tag': f'B-{entity_type}',
                'color': color,
                'type': 'begin',
                'entity_type': entity_type
            })
            tags_with_colors.append({
                'tag': f'I-{entity_type}',
                'color': color,
                'type': 'inside',
                'entity_type': entity_type
            })
        
        return JsonResponse({
            'tags': labels,
            'entity_types': sorted_entities,
            'tags_with_colors': tags_with_colors,
            'total': len(labels)
        })
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('get_available_tags failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


@csrf_exempt
def add_entity_type(request):
    """Add a new entity type to label_map.json"""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    
    try:
        data = json.loads(request.body)
        entity_name = data.get('name', '').strip().upper()
        
        if not entity_name:
            return JsonResponse({'error': 'Entity type name is required'}, status=400)
        
        # Validate entity name (alphanumeric and underscores only)
        import re
        if not re.match(r'^[A-Z][A-Z0-9_]*$', entity_name):
            return JsonResponse({
                'error': 'Entity name must start with a letter and contain only letters, numbers, and underscores'
            }, status=400)
        
        # Load existing labels
        labels = ['O']
        if LABEL_MAP_PATH.exists():
            with open(LABEL_MAP_PATH, 'r', encoding='utf-8') as f:
                labels = json.load(f)
        
        # Check if entity type already exists
        b_label = f'B-{entity_name}'
        i_label = f'I-{entity_name}'
        
        if b_label in labels or i_label in labels:
            return JsonResponse({
                'error': f'Entity type "{entity_name}" already exists'
            }, status=400)
        
        # Add new labels (B- and I- tags)
        labels.append(b_label)
        labels.append(i_label)
        
        # Ensure data directory exists
        LABEL_MAP_PATH.parent.mkdir(parents=True, exist_ok=True)
        
        # Save updated labels
        with open(LABEL_MAP_PATH, 'w', encoding='utf-8') as f:
            json.dump(labels, f, indent=4)
        
        return JsonResponse({
            'success': True,
            'message': f'Entity type "{entity_name}" added successfully',
            'entity_type': {
                'name': entity_name,
                'b_label': b_label,
                'i_label': i_label,
            }
        })
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('add_entity_type failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


@csrf_exempt
def delete_entity_type(request):
    """Delete an entity type from label_map.json"""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    
    try:
        data = json.loads(request.body)
        entity_name = data.get('name', '').strip().upper()
        
        if not entity_name:
            return JsonResponse({'error': 'Entity type name is required'}, status=400)
        
        if not LABEL_MAP_PATH.exists():
            return JsonResponse({'error': 'Label map file not found'}, status=404)
        
        # Load existing labels
        with open(LABEL_MAP_PATH, 'r', encoding='utf-8') as f:
            labels = json.load(f)
        
        b_label = f'B-{entity_name}'
        i_label = f'I-{entity_name}'
        
        # Check if entity type exists
        if b_label not in labels and i_label not in labels:
            return JsonResponse({
                'error': f'Entity type "{entity_name}" not found'
            }, status=404)
        
        # Check if entity type is used in training data
        in_use = False
        usage_count = 0
        if LABELS_PATH.exists():
            with open(LABELS_PATH, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                        tags = entry.get('tags', [])
                        if b_label in tags or i_label in tags:
                            in_use = True
                            usage_count += 1
                    except json.JSONDecodeError:
                        continue
        
        # Warn if entity type is in use (but allow deletion)
        warning = None
        if in_use:
            warning = f'Warning: Entity type "{entity_name}" is used in {usage_count} training entries. Deleting may affect model training.'
        
        # Remove labels
        labels = [l for l in labels if l not in (b_label, i_label)]
        
        # Save updated labels
        with open(LABEL_MAP_PATH, 'w', encoding='utf-8') as f:
            json.dump(labels, f, indent=4)
        
        response = {
            'success': True,
            'message': f'Entity type "{entity_name}" deleted successfully',
            'deleted': [b_label, i_label]
        }
        
        if warning:
            response['warning'] = warning
        
        return JsonResponse(response)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('delete_entity_type failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


def _run_training_script(config):
    """Run the training script in a subprocess and capture output"""
    global _training_process, _training_logs, _training_status
    
    try:
        _training_logs = []
        _training_status = 'running'
        
        # Prepare command with arguments
        python_exe = sys.executable
        script_path = str(PROJECT_ROOT / 'train' / 'train_token_classifier.py')
        
        # Build command with config parameters
        cmd = [
            python_exe,
            script_path,
            '--base_model', config.get('baseModel', 'distilbert-base-uncased'),
            '--epochs', str(config.get('epochs', 3)),
            '--batch_size', str(config.get('batchSize', 16)),
            '--learning_rate', str(config.get('learningRate', 0.00002)),
            '--max_length', str(config.get('maxLength', 512)),
            '--output_dir', f"models/{config.get('modelName', 'slot_model')}"
        ]
        
        # Start subprocess
        _training_process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            cwd=str(PROJECT_ROOT)
        )
        
        # Read output line by line
        for line in _training_process.stdout:
            line = line.strip()
            if line:
                timestamp = datetime.now().strftime('%H:%M:%S')
                log_entry = {'time': timestamp, 'message': line}
                _training_logs.append(log_entry)
                logging.info(f'Training: {line}')
        
        # Wait for process to complete
        return_code = _training_process.wait()
        
        if return_code == 0:
            _training_status = 'completed'
            _training_logs.append({
                'time': datetime.now().strftime('%H:%M:%S'),
                'message': '✅ Training completed successfully!'
            })
        else:
            _training_status = 'failed'
            _training_logs.append({
                'time': datetime.now().strftime('%H:%M:%S'),
                'message': f'❌ Training failed with code {return_code}'
            })
    
    except Exception as e:
        _training_status = 'failed'
        _training_logs.append({
            'time': datetime.now().strftime('%H:%M:%S'),
            'message': f'❌ Error: {str(e)}'
        })
        logging.exception('Training script failed')
    finally:
        _training_process = None


@csrf_exempt
def start_training(request):
    """Start NER model training"""
    global _training_status, _training_logs
    
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    
    try:
        # Check if already training
        if _training_status == 'running':
            return JsonResponse({'error': 'Training already in progress'}, status=400)
        
        data = json.loads(request.body)
        config = {
            'modelName': data.get('modelName', 'slot_model'),
            'baseModel': data.get('baseModel', 'distilbert-base-uncased'),
            'epochs': data.get('epochs', 3),
            'batchSize': data.get('batchSize', 16),
            'learningRate': data.get('learningRate', 0.00002),
            'maxLength': data.get('maxLength', 512),
        }
        
        # Reset state
        _training_logs = [{
            'time': datetime.now().strftime('%H:%M:%S'),
            'message': 'Starting training...'
        }]
        _training_status = 'running'
        
        # Start training in background thread
        thread = threading.Thread(target=_run_training_script, args=(config,))
        thread.daemon = True
        thread.start()
        
        return JsonResponse({
            'success': True,
            'message': 'Training started',
            'status': 'running'
        })
    
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('start_training failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


@csrf_exempt
def get_training_status(request):
    """Get current training status and logs"""
    if request.method != 'GET':
        return JsonResponse({'error': 'GET required'}, status=405)
    
    try:
        return JsonResponse({
            'status': _training_status,
            'logs': _training_logs,
            'isRunning': _training_status == 'running'
        })
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('get_training_status failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


@csrf_exempt
def stop_training(request):
    """Stop the running training process"""
    global _training_process, _training_status, _training_logs
    
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    
    try:
        if _training_process and _training_process.poll() is None:
            _training_process.terminate()
            _training_process.wait(timeout=5)
            _training_status = 'failed'
            _training_logs.append({
                'time': datetime.now().strftime('%H:%M:%S'),
                'message': '⚠️ Training stopped by user'
            })
            return JsonResponse({
                'success': True,
                'message': 'Training stopped'
            })
        else:
            return JsonResponse({'error': 'No training process running'}, status=400)
    
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('stop_training failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)

