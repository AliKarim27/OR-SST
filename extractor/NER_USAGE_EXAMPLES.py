"""
NER Module - Usage Examples
Demonstrates how to use the NER parent node structure for entity extraction.
"""
import logging
from extractor import NERFactory, NERConfig, BaseNER

# Configure logging to see factory messages
logging.basicConfig(level=logging.INFO)


def example_1_basic_usage():
    """
    Example 1: Basic usage with default configuration
    """
    print("\n=== Example 1: Basic Usage ===")
    
    # Create default configuration
    config = NERConfig()
    
    # Create NER instance using factory
    ner = NERFactory.create('slot-filling', config)
    
    if ner is None:
        print("Failed to create NER model")
        return
    
    # Extract entities from transcript
    transcript = "surgery date was january 15th 2025 surgeon was doctor smith"
    result = ner.extract(transcript)
    
    print(f"Extracted entities: {result}")
    print(f"Model info: {ner.get_model_info()}")


def example_2_custom_configuration():
    """
    Example 2: Custom configuration with CUDA and custom parameters
    """
    print("\n=== Example 2: Custom Configuration ===")
    
    # Create custom configuration
    config = NERConfig(
        model_type='slot-filling',
        model_dir='models/slot_model',
        device='cuda',  # Use GPU if available
        aggregation_strategy='simple',
        max_length=512,
        batch_size=4,
        confidence_threshold=0.7
    )
    
    # Validate configuration before creating model
    validation = NERFactory.validate_model('slot-filling', config)
    print(f"Validation result: {validation}")
    
    if validation['available']:
        ner = NERFactory.create('slot-filling', config)
        if ner:
            print(f"Model created successfully on {ner.config.device}")
            print(f"Model info: {ner.get_model_info()}")


def example_3_list_available_models():
    """
    Example 3: List all available NER implementations
    """
    print("\n=== Example 3: List Available Models ===")
    
    available_types = NERFactory.get_available_types()
    print(f"Available NER types: {available_types}")
    
    # Can also use the alias
    available = NERFactory.list_available()
    print(f"Registered implementations: {available}")


def example_4_configuration_from_dict():
    """
    Example 4: Create configuration from dictionary (useful for loading from config files)
    """
    print("\n=== Example 4: Configuration from Dictionary ===")
    
    # Configuration as dictionary (e.g., loaded from JSON/YAML)
    config_dict = {
        'model_type': 'slot-filling',
        'model_dir': 'models/slot_model',
        'device': 'cpu',
        'aggregation_strategy': 'simple',
        'max_length': 512,
        'batch_size': 1,
        'confidence_threshold': 0.5
    }
    
    # Create config from dictionary
    config = NERConfig.from_dict(config_dict)
    
    # Create NER instance
    ner = NERFactory.create('slot-filling', config)
    
    if ner:
        print(f"Created NER from config dict: {config.to_dict()}")


def example_5_error_handling():
    """
    Example 5: Proper error handling
    """
    print("\n=== Example 5: Error Handling ===")
    
    # Try to create with invalid model type
    config = NERConfig()
    ner = NERFactory.create('invalid-type', config)
    
    if ner is None:
        print("Correctly handled invalid model type")
    
    # Try to create with non-existent model directory
    bad_config = NERConfig(model_dir='non/existent/path')
    validation = NERFactory.validate_model('slot-filling', bad_config)
    print(f"Validation with bad path: {validation}")


def example_6_full_pipeline():
    """
    Example 6: Complete extraction pipeline
    """
    print("\n=== Example 6: Full Pipeline ===")
    
    # Step 1: Configure
    config = NERConfig(
        model_type='slot-filling',
        model_dir='models/slot_model',
        device='cpu',
        confidence_threshold=0.6
    )
    
    # Step 2: Validate
    validation = NERFactory.validate_model('slot-filling', config)
    if not validation['available']:
        print(f"Model not available: {validation['message']}")
        return
    
    if validation['warnings']:
        print(f"Warnings: {validation['warnings']}")
    
    # Step 3: Create model
    ner = NERFactory.create('slot-filling', config)
    if not ner:
        print("Failed to create NER model")
        return
    
    # Step 4: Extract entities
    transcript = """
    surgery performed on january 15th 2025 at 08 30 am
    surgeon dr john smith
    anesthetist dr jane doe
    procedure appendectomy
    medications propofol 200mg fentanyl 100mcg
    """
    
    # Optional: Preprocess text
    preprocessed = ner.preprocess(transcript)
    
    # Extract entities
    result = ner.extract(preprocessed)
    
    print(f"Extraction result: {result}")
    
    # Get model info
    info = ner.get_model_info()
    print(f"Model used: {info}")


def example_7_register_custom_implementation():
    """
    Example 7: Register a custom NER implementation
    """
    print("\n=== Example 7: Custom Implementation ===")
    
    # Define a custom NER implementation
    class CustomNER(BaseNER):
        """Custom NER implementation example"""
        
        def __init__(self, config: NERConfig):
            super().__init__(config)
            # Initialize custom model here
            self.initialized = True
        
        def extract(self, transcript: str) -> dict:
            # Custom extraction logic
            return {"custom": "extraction", "text": transcript[:50]}
        
        def is_available(self) -> bool:
            return hasattr(self, 'initialized') and self.initialized
        
        def get_model_info(self) -> dict:
            return {
                "status": "available",
                "type": "custom",
                "model_dir": self.config.model_dir
            }
    
    # Register the custom implementation
    NERFactory.register('custom', CustomNER)
    
    # Verify registration
    print(f"Available types after registration: {NERFactory.get_available_types()}")
    
    # Use the custom implementation
    config = NERConfig(model_type='custom')
    custom_ner = NERFactory.create('custom', config)
    
    if custom_ner:
        result = custom_ner.extract("Test transcript")
        print(f"Custom extraction result: {result}")


if __name__ == '__main__':
    print("NER Module Usage Examples")
    print("=" * 50)
    
    # Run all examples
    example_1_basic_usage()
    example_2_custom_configuration()
    example_3_list_available_models()
    example_4_configuration_from_dict()
    example_5_error_handling()
    example_6_full_pipeline()
    example_7_register_custom_implementation()
    
    print("\n" + "=" * 50)
    print("All examples completed!")
