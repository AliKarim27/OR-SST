from faster_whisper import WhisperModel
import numpy as np
import librosa
from .base_stt import BaseSTT, postprocess_for_ner

TARGET_SR = 16000


class FasterWhisperSTT(BaseSTT):
    """Faster-Whisper STT implementation"""
    
    def __init__(self, model_name="base", device="cpu", compute_type="int8"):
        super().__init__(model_name, device, compute_type)
        try:
            self.model = WhisperModel(model_name, device=device, compute_type=compute_type)
        except Exception as e:
            raise RuntimeError(f"Failed to load Faster-Whisper model '{model_name}': {e}")

    def preprocess(self, audio_tuple):
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

    def transcribe(self, audio_16k: np.ndarray, language="en", postprocess: bool = True) -> str:
        """
        Transcribe audio to text.
        
        Args:
            audio_16k: Preprocessed 16kHz audio data
            language: Language code (default: "en")
            postprocess: If True, applies post-processing for NER model input
                        (lowercase, remove punctuation, normalize whitespace)
        
        Returns:
            Transcribed text string
        """
        print("DEBUG | audio length:", len(audio_16k))
        print("DEBUG | audio min/max:", audio_16k.min(), audio_16k.max())

        segments, info = self.model.transcribe(audio_16k, language=language)

        text = " ".join(s.text for s in segments).strip()
        print("DEBUG | raw transcript:", text)
        
        # Apply post-processing for DistilBERT NER model
        if postprocess:
            text = postprocess_for_ner(text)
            print("DEBUG | processed transcript:", text)
        
        return text
    
    def is_available(self) -> bool:
        """Check if faster-whisper is available"""
        try:
            import faster_whisper
            return True
        except ImportError:
            return False


# Backward compatibility alias
STT = FasterWhisperSTT

