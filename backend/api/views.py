import json
import os
import tempfile
from datetime import datetime
from pathlib import Path
import sys
from typing import Any, Dict

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

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
OUTPUTS_DIR = PROJECT_ROOT / 'data' / 'outputs'
LABELS_DIR = PROJECT_ROOT / 'data' / 'labels'
OUTPUTS_PATH = OUTPUTS_DIR / 'extracted.jsonl'
LABELS_PATH = LABELS_DIR / 'train.jsonl'

# Lazy imports for heavy models
_stt = None
_extractor = None


def _ensure_mono(y: np.ndarray) -> np.ndarray:
    if y.ndim == 1:
        return y
    return np.mean(y, axis=0)


def _load_stt():
    global _stt
    if _stt is None:
        try:
            from stt.stt_whisper import STT

            _stt = STT(model_name='base', device='cpu', compute_type='int8')
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

                _extractor = SlotFillingExtractor(str(MODEL_DIR))
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
        audio_dir = PROJECT_ROOT / 'data' / 'audio'
        if not audio_dir.exists():
            return JsonResponse({'list': []})
        files = [p.name for p in sorted(audio_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True) if p.is_file()]
        # Provide a URL pointing to the get_audio endpoint
        result = [{'name': n, 'url': f"/api/get_audio/?name={n}"} for n in files]
        return JsonResponse({'list': result})
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('list_audio failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)


def get_audio(request):
    try:
        name = request.GET.get('name')
        if not name:
            return JsonResponse({'error': 'name required'}, status=400)
        audio_path = PROJECT_ROOT / 'data' / 'audio' / name
        if not audio_path.exists() or not audio_path.is_file():
            return JsonResponse({'error': 'not found'}, status=404)
        from django.http import FileResponse
        return FileResponse(open(audio_path, 'rb'), content_type='audio/wav')
    except Exception as e:
        tb = traceback.format_exc()
        logging.error('get_audio failed: %s', tb)
        return JsonResponse({'error': str(e), 'trace': tb}, status=500)

