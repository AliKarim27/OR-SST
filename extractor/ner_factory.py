"""
NER Factory for creating and validating NER model instances.
"""
import logging
from typing import Optional, Dict, List
from .base_ner import BaseNER, NERConfig


class NERFactory:
    """Factory for creating NER model instances"""
    
    # Registry of available NER implementations
    _registry: Dict[str, type] = {}
    
    @classmethod
    def register(cls, model_type: str, ner_class: type):
        """
        Register a NER implementation.
        
        Args:
            model_type: String identifier for the model type (e.g., 'slot-filling', 'distilbert')
            ner_class: Class that inherits from BaseNER
        """
        if not issubclass(ner_class, BaseNER):
            raise ValueError(f"{ner_class} must inherit from BaseNER")
        cls._registry[model_type.lower()] = ner_class
        logging.info(f"Registered NER implementation: {model_type}")
    
    @classmethod
    def create(cls, model_type: str, config: NERConfig) -> Optional[BaseNER]:
        """
        Create a NER model instance.
        
        Args:
            model_type: Type of NER model (e.g., 'slot-filling', 'distilbert')
            config: NERConfig instance with model configuration
        
        Returns:
            NER model instance or None if creation fails
        """
        model_type_lower = model_type.lower()
        
        if model_type_lower not in cls._registry:
            logging.error(f"Unknown NER model type: {model_type}")
            logging.info(f"Available types: {list(cls._registry.keys())}")
            return None
        
        # Check if implementation is available before creating
        ner_class = cls._registry[model_type_lower]
        try:
            temp_instance = ner_class.__new__(ner_class)
            if hasattr(temp_instance, 'is_available') and not temp_instance.is_available():
                logging.error(f"NER implementation '{model_type}' is not available (missing dependencies or model)")
                return None
        except Exception as e:
            logging.warning(f"Could not check availability of '{model_type}': {e}. Proceeding with creation...")
        
        # Create the actual instance
        try:
            instance = ner_class(config)
            
            if not instance.is_available():
                logging.error(f"NER model {model_type} is not available (dependencies missing or model not found)")
                return None
            
            logging.info(f"Created NER instance: {model_type} from {config.model_dir}")
            return instance
        except Exception as e:
            logging.error(f"Failed to create NER model {model_type}: {str(e)}")
            return None
    
    @classmethod
    def get_available_types(cls) -> List[str]:
        """
        Get list of registered NER types.
        
        Returns:
            List of available NER type names
        """
        return list(cls._registry.keys())
    
    @classmethod
    def list_available(cls) -> List[str]:
        """
        List all registered NER implementations (alias for get_available_types).
        
        Returns:
            List of registered model type strings
        """
        return cls.get_available_types()
    
    @classmethod
    def validate_model(cls, model_type: str, config: NERConfig) -> Dict[str, any]:
        """
        Validate if a model configuration is valid and available.
        
        Args:
            model_type: Type of NER model
            config: NERConfig instance with model configuration
        
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
        ner_class = cls._registry[model_type_lower]
        try:
            temp_instance = ner_class.__new__(ner_class)
            if hasattr(temp_instance, 'is_available') and not temp_instance.is_available():
                result['message'] = f"Model type '{model_type}' is registered but dependencies or model files are missing"
                return result
        except Exception as e:
            result['message'] = f"Error checking availability: {e}"
            result['warnings'].append("Could not verify model availability before instantiation")
        
        result['available'] = True
        result['message'] = f"Model {model_type} at {config.model_dir} is valid and available"
        
        # Add warnings for specific configurations
        if config.device == 'cuda':
            try:
                import torch
                if not torch.cuda.is_available():
                    result['warnings'].append("CUDA device specified but CUDA is not available. Will fall back to CPU.")
            except ImportError:
                result['warnings'].append("CUDA device specified but PyTorch is not installed.")
        
        # Check if model directory exists
        import os
        if not os.path.exists(config.model_dir):
            result['warnings'].append(f"Model directory '{config.model_dir}' does not exist")
        
        return result
    
    @classmethod
    def clear_registry(cls):
        """Clear all registered implementations (mainly for testing)."""
        cls._registry.clear()


# Auto-register available NER implementations
def _register_implementations():
    """Auto-register all available NER implementations"""
    
    # Register Slot Filling Extractor
    try:
        from .model_infer import SlotFillingExtractor
        NERFactory.register('slot-filling', SlotFillingExtractor)
        NERFactory.register('distilbert', SlotFillingExtractor)  # Alias
    except ImportError as e:
        logging.warning(f"Could not register SlotFillingExtractor: {e}")
    
    # Future: Register other NER implementations here
    # try:
    #     from .spacy_ner import SpacyNER
    #     NERFactory.register('spacy', SpacyNER)
    # except ImportError:
    #     pass


# Initialize registry on module load
_register_implementations()
