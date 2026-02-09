"""
Example template for adding a new STT implementation.
This shows how to add OpenAI's original Whisper model.

To use this:
1. Install dependencies: pip install openai-whisper
2. Uncomment the registration in stt/factory.py
3. The new model type will automatically appear in the UI
"""
from .base_stt import BaseSTT
import numpy as np
import librosa

TARGET_SR = 16000


class OpenAIWhisperSTT(BaseSTT):
    """OpenAI Whisper STT implementation (original, not faster-whisper)"""
    
    def __init__(self, model_name="base", device="cpu", compute_type="float32"):
        super().__init__(model_name, device, compute_type)
        try:
            import whisper
            self.model = whisper.load_model(model_name, device=device)
        except Exception as e:
            raise RuntimeError(f"Failed to load OpenAI Whisper model '{model_name}': {e}")

    def preprocess(self, audio_tuple):
        """Preprocess audio for OpenAI Whisper"""
        if audio_tuple is None:
            return None
        sr, audio = audio_tuple
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        audio = audio.astype(np.float32)
        audio = librosa.resample(audio, orig_sr=sr, target_sr=TARGET_SR)
        mx = float(np.max(np.abs(audio))) if len(audio) else 0.0
        if mx > 0:
            audio = audio / mx
        return audio

    def transcribe(self, audio_16k: np.ndarray, language="en") -> str:
        """Transcribe using OpenAI Whisper"""
        result = self.model.transcribe(
            audio_16k,
            language=language,
            fp16=False
        )
        return result["text"].strip()
    
    def is_available(self) -> bool:
        """Check if openai-whisper is installed"""
        try:
            import whisper
            return True
        except ImportError:
            return False


# To enable this implementation, add to stt/factory.py:
# try:
#     from .stt_openai import OpenAIWhisperSTT
#     STTFactory.register('openai-whisper', OpenAIWhisperSTT)
# except ImportError:
#     pass
