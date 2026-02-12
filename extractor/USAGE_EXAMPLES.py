"""
Example usage of the NER parent node factory pattern for OR-SST.
"""

from extractor import NERFactory, NERConfig

# ============================================
# Method 1: Using the Factory Pattern (Recommended)
# ============================================

# Create a configuration for the NER model
config = NERConfig(
    model_dir="models/slot_model",
    model_type="distilbert-based",
    aggregation_strategy="simple",
    device="cuda",  # or "cpu"
    batch_size=32,
    max_length=512
)

# Create a SlotFillingExtractor instance using the factory
extractor = NERFactory.create(
    model_type="slot-filling",
    config=config
)

if extractor is not None and extractor.is_available():
    # Extract entities from transcript
    transcript = "the patient was anesthetized by doctor smith at 14 30"
    result = extractor.extract(transcript)
    print("Extracted entities:", result)
    
    # Get model information
    model_info = extractor.get_model_info()
    print("Model info:", model_info)
else:
    print("Failed to initialize extractor")


# ============================================
# Method 2: Direct Instantiation (Legacy Support)
# ============================================

from extractor import SlotFillingExtractor

config = NERConfig(
    model_dir="models/slot_model",
    aggregation_strategy="simple"
)

extractor = SlotFillingExtractor(config)

if extractor.is_available():
    result = extractor.extract(transcript)
    print("Extracted:", result)


# ============================================
# Listing Available NER Models
# ============================================

available_models = NERFactory.list_available()
print(f"Available NER models: {available_models}")
# Output: ['slot-filling']


# ============================================
# Registering Custom NER Implementation
# ============================================

from extractor import BaseNER, NERFactory

class CustomNER(BaseNER):
    """Example custom NER implementation"""
    
    def extract(self, text: str) -> dict:
        # Your custom extraction logic here
        return {}
    
    def is_available(self) -> bool:
        return self.model is not None
    
    def get_model_info(self) -> dict:
        return {"type": "custom"}

# Register your custom implementation
NERFactory.register("custom", CustomNER)

# Now you can create it with the factory
custom_config = NERConfig(model_dir="custom_model_path")
custom_extractor = NERFactory.create("custom", custom_config)
