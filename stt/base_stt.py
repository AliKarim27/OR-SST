"""
Base STT (Speech-to-Text) interface for OR-SST project.
All STT implementations should inherit from this base class.
"""
from abc import ABC, abstractmethod
import numpy as np


class BaseSTT(ABC):
    """Abstract base class for Speech-to-Text models"""
    
    def __init__(self, model_name: str, device: str = "cpu", compute_type: str = "int8"):
        self.model_name = model_name
        self.device = device
        self.compute_type = compute_type
        self.model = None
    
    @abstractmethod
    def preprocess(self, audio_tuple):
        """
        Preprocess audio for transcription.
        
        Args:
            audio_tuple: Tuple of (sample_rate, audio_data)
        
        Returns:
            Preprocessed audio ready for transcription
        """
        pass
    
    @abstractmethod
    def transcribe(self, audio_data: np.ndarray, language: str = "en") -> str:
        """
        Transcribe audio to text.
        
        Args:
            audio_data: Preprocessed audio data
            language: Language code (default: "en")
        
        Returns:
            Transcribed text string
        """
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """
        Check if this STT implementation is available (dependencies installed).
        
        Returns:
            True if the model can be loaded, False otherwise
        """
        pass
    
    def get_info(self) -> dict:
        """
        Get information about this STT model.
        
        Returns:
            Dictionary with model information
        """
        return {
            'model_name': self.model_name,
            'device': self.device,
            'compute_type': self.compute_type,
            'type': self.__class__.__name__,
        }
