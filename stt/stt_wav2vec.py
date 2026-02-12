"""
Wav2Vec2 STT implementation using HuggingFace Transformers.
"""
from typing import Optional
import numpy as np
import librosa
import torch
from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC
from .base_stt import BaseSTT, postprocess_for_ner

TARGET_SR = 16000


class Wav2Vec2STT(BaseSTT):
    """Wav2Vec2 STT implementation"""

    def __init__(self, model_name: str = "facebook/wav2vec2-base-960h", device: str = "cpu", compute_type: str = "float32"):
        super().__init__(model_name, device, compute_type)
        self.device = self._resolve_device(device)
        try:
            self.processor = Wav2Vec2Processor.from_pretrained(model_name)
            self.model = Wav2Vec2ForCTC.from_pretrained(model_name).to(self.device)
            self.model.eval()
        except Exception as e:
            raise RuntimeError(f"Failed to load Wav2Vec2 model '{model_name}': {e}")

    def _resolve_device(self, device: str) -> str:
        if device == "cuda" and torch.cuda.is_available():
            return "cuda"
        return "cpu"

    def preprocess(self, audio_tuple) -> Optional[np.ndarray]:
        if audio_tuple is None:
            return None
        sr, audio = audio_tuple
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        audio = audio.astype(np.float32)
        if sr != TARGET_SR:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=TARGET_SR)
        mx = float(np.max(np.abs(audio))) if len(audio) else 0.0
        if mx > 0:
            audio = audio / mx
        return audio

    def transcribe(self, audio_data: np.ndarray, language: str = "en", postprocess: bool = True) -> str:
        """
        Transcribe audio to text.
        
        Args:
            audio_data: Preprocessed audio data
            language: Language code (ignored for Wav2Vec2, English-only)
            postprocess: If True, applies post-processing for NER model input
                        (lowercase, remove punctuation, normalize whitespace)
        
        Returns:
            Transcribed text string
        """
        if audio_data is None or len(audio_data) == 0:
            return ""
        # Wav2Vec2 models are typically English-only; language is ignored.
        inputs = self.processor(audio_data, sampling_rate=TARGET_SR, return_tensors="pt", padding=True)
        input_values = inputs.input_values.to(self.device)
        attention_mask = inputs.attention_mask.to(self.device) if "attention_mask" in inputs else None

        with torch.no_grad():
            logits = self.model(input_values, attention_mask=attention_mask).logits
            predicted_ids = torch.argmax(logits, dim=-1)

        transcript = self.processor.batch_decode(predicted_ids)[0].strip()
        
        # Apply post-processing for DistilBERT NER model
        if postprocess:
            transcript = postprocess_for_ner(transcript)
        
        return transcript

    def is_available(self) -> bool:
        try:
            import transformers  # noqa: F401
            import torch  # noqa: F401
            return True
        except ImportError:
            return False


STT = Wav2Vec2STT
