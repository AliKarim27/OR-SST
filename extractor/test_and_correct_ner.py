#!/usr/bin/env python3
"""
Example script to run the NER Interactive Tester.
This allows testing and correcting NER predictions for model retraining.

Usage:
    python extractor/test_and_correct_ner.py
"""
import sys
import logging
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from extractor.ner_interactive_tester import NERInteractiveTester
from extractor.base_ner import NERConfig


def main():
    """
    Main entry point for interactive NER testing.
    """
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='[%(levelname)s] %(name)s: %(message)s'
    )
    
    logger = logging.getLogger(__name__)
    
    print("\n" + "=" * 100)
    print("NER INTERACTIVE TESTER SETUP")
    print("=" * 100)
    
    # Check if model exists
    model_dir = Path('models/slot_model')
    if not model_dir.exists():
        print(f"ERROR: Model directory not found at {model_dir}")
        print("Please ensure the model has been trained first.")
        return
    
    # Check if label map exists
    label_map = Path('data/label_map.json')
    if not label_map.exists():
        print(f"ERROR: Label map not found at {label_map}")
        print("Please ensure data/label_map.json exists.")
        return
    
    # Create configuration
    config = NERConfig(
        model_type='slot-filling',
        model_dir=str(model_dir),
        device='cpu'  # Change to 'cuda' if you have GPU
    )
    
    # Validate configuration
    from extractor.ner_factory import NERFactory
    validation = NERFactory.validate_model('slot-filling', config)
    
    if not validation['available']:
        print(f"ERROR: Model validation failed")
        print(f"Message: {validation.get('message')}")
        if validation.get('warnings'):
            print(f"Warnings: {validation['warnings']}")
        return
    
    print(f"✓ Model found and validated")
    print(f"✓ Label map found")
    print()
    
    # Get user info
    print("Enter your name (for correction metadata) or press Enter to skip:")
    user_name = input().strip() or None
    
    # Initialize tester
    print("\nInitializing NER tester...")
    tester = NERInteractiveTester(config, correction_output_path='data/labels/corrections.jsonl')
    
    if tester.ner is None or not tester.ner.is_available():
        print("ERROR: Failed to initialize NER model")
        return
    
    print("✓ NER model loaded successfully")
    print()
    
    # Start interactive session
    tester.interactive_session(user_name=user_name)
    
    # After session, offer to review corrections
    print("\n" + "=" * 100)
    print("POST-SESSION OPTIONS")
    print("=" * 100)
    
    corrections_file = Path('data/labels/corrections.jsonl')
    if corrections_file.exists() and corrections_file.stat().st_size > 0:
        print("\nWould you like to analyze the corrections you made? (yes/no)")
        if input().strip().lower() == 'yes':
            from extractor.correction_manager import CorrectionManager
            manager = CorrectionManager()
            
            print("\n" + "-" * 100)
            print("CORRECTION ANALYSIS")
            print("-" * 100)
            
            # Validate
            validation = manager.validate_corrections()
            print(f"\nValidation Results:")
            print(f"  Total records: {validation['total_records']}")
            print(f"  Valid records: {validation['valid_records']}")
            if validation['issues']:
                print(f"  Issues found: {len(validation['issues'])}")
            
            # Analyze
            analysis = manager.analyze_corrections()
            print(f"\nAnalysis Results:")
            print(f"  Total correction records: {analysis['total_correction_records']}")
            if analysis.get('unique_correctors'):
                print(f"  Contributors: {', '.join(analysis['unique_correctors'])}")
            
            if analysis.get('most_common_tags'):
                print(f"  Most common tags:")
                for tag, count in analysis['most_common_tags'][:3]:
                    print(f"    - {tag}: {count}")
            
            # Export report
            print("\nExporting detailed report...")
            manager.export_corrections_report()
            print(f"✓ Report saved to corrections_report.json")
    
    print("\n" + "=" * 100)
    print("NEXT STEPS FOR RETRAINING")
    print("=" * 100)
    print("""
To merge corrections with your training data and retrain:

1. Review corrections (optional):
   python -m extractor.correction_manager

2. Merge corrections with training data:
   from extractor.correction_manager import CorrectionManager
   manager = CorrectionManager()
   manager.merge_corrections(output_file='data/labels/train_merged.jsonl')

3. Run training with merged data:
   python train/train_token_classifier.py
   
   (Or modify the script to use 'data/labels/train_merged.jsonl')

4. Evaluate the new model on your test set.
""")
    print("=" * 100 + "\n")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
