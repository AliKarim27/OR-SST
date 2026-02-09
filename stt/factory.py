"""
STT Factory for creating and validating STT model instances.
"""
import logging
from typing import Optional, Dict, List
from .base_stt import BaseSTT


class STTFactory:
    """Factory for creating STT model instances"""
    
    # Registry of available STT implementations
    _registry: Dict[str, type] = {}
    
    @classmethod
    def register(cls, model_type: str, stt_class: type):
        """
        Register an STT implementation.
        
        Args:
            model_type: String identifier for the model type (e.g., 'whisper', 'faster-whisper')
            stt_class: Class that inherits from BaseSTT
        """
        if not issubclass(stt_class, BaseSTT):
            raise ValueError(f"{stt_class} must inherit from BaseSTT")
        cls._registry[model_type.lower()] = stt_class
        logging.info(f"Registered STT implementation: {model_type}")
    
    @classmethod
    def create(cls, model_type: str, model_name: str, device: str = "cpu", 
               compute_type: str = "int8") -> Optional[BaseSTT]:
        """
        Create an STT model instance.
        
        Args:
            model_type: Type of STT model (e.g., 'whisper', 'faster-whisper')
            model_name: Name/size of the model (e.g., 'base', 'small')
            device: Device to run on ('cpu', 'cuda')
            compute_type: Compute precision ('int8', 'float16', 'float32')
        
        Returns:
            STT model instance or None if creation fails
        """
        model_type_lower = model_type.lower()
        
        if model_type_lower not in cls._registry:
            logging.error(f"Unknown STT model type: {model_type}")
            return None
        
        stt_class = cls._registry[model_type_lower]
        
        # Check if implementation is available
        try:
            temp_instance = stt_class.__new__(stt_class)
            if not temp_instance.is_available():
                logging.error(f"STT implementation '{model_type}' is not available (missing dependencies)")
                return None
        except Exception as e:
            logging.error(f"Error checking availability of '{model_type}': {e}")
            return None
        
        # Create the actual instance
        try:
            instance = stt_class(model_name=model_name, device=device, compute_type=compute_type)
            logging.info(f"Created STT instance: {model_type}/{model_name} on {device}")
            return instance
        except Exception as e:
            logging.error(f"Failed to create STT instance '{model_type}/{model_name}': {e}")
            return None
    
    @classmethod
    def get_available_types(cls) -> List[str]:
        """
        Get list of registered STT types.
        
        Returns:
            List of available STT type names
        """
        return list(cls._registry.keys())
    
    @classmethod
    def validate_model(cls, model_type: str, model_name: str, device: str = "cpu",
                      compute_type: str = "int8") -> Dict[str, any]:
        """
        Validate if a model configuration is valid and available.
        
        Args:
            model_type: Type of STT model
            model_name: Name/size of the model
            device: Device to run on
            compute_type: Compute precision
        
        Returns:
            Dictionary with validation result:
            {
                'valid': bool,
                'available': bool,
                'message': str,
                'warnings': List[str]
            }
        """
        result = {
            'valid': False,
            'available': False,
            'message': '',
            'warnings': []
        }
        
        model_type_lower = model_type.lower()
        
        # Check if type is registered
        if model_type_lower not in cls._registry:
            result['message'] = f"Unknown model type: {model_type}. Available types: {', '.join(cls.get_available_types())}"
            return result
        
        result['valid'] = True
        
        # Check if implementation is available
        stt_class = cls._registry[model_type_lower]
        try:
            temp_instance = stt_class.__new__(stt_class)
            if not temp_instance.is_available():
                result['message'] = f"Model type '{model_type}' is registered but dependencies are not installed"
                return result
        except Exception as e:
            result['message'] = f"Error checking availability: {e}"
            return result
        
        result['available'] = True
        result['message'] = f"Model {model_type}/{model_name} is valid and available"
        
        # Add warnings for specific configurations
        if device == 'cuda':
            try:
                import torch
                if not torch.cuda.is_available():
                    result['warnings'].append("CUDA device specified but CUDA is not available. Will fall back to CPU.")
            except ImportError:
                result['warnings'].append("CUDA device specified but PyTorch is not installed.")
        
        return result


# Auto-register available STT implementations
def _register_implementations():
    """Auto-register all available STT implementations"""
    
    # Register Faster-Whisper
    try:
        from .stt_whisper import FasterWhisperSTT
        STTFactory.register('whisper', FasterWhisperSTT)
        STTFactory.register('faster-whisper', FasterWhisperSTT)
    except ImportError as e:
        logging.warning(f"Could not register Faster-Whisper: {e}")
    
    # Future: Register other STT implementations here
    # try:
    #     from .stt_openai import OpenAIWhisperSTT
    #     STTFactory.register('openai-whisper', OpenAIWhisperSTT)
    # except ImportError:
    #     pass


# Initialize registry on module load
_register_implementations()
