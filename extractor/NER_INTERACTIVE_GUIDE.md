# NER Interactive Tester & Correction Manager

This module provides tools to interactively test your NER model, correct prediction errors, and automatically collect corrected data for model retraining.

## Overview

The workflow consists of three main components:

1. **NER Interactive Tester** (`ner_interactive_tester.py`) - Test the model and collect user corrections
2. **Correction Manager** (`correction_manager.py`) - Manage, validate, and merge corrections into training data
3. **Test & Correct Script** (`test_and_correct_ner.py`) - Easy-to-use entry point for the full workflow

## Quick Start

### Run the Interactive Tester

```bash
python extractor/test_and_correct_ner.py
```

This will:
1. Validate that your model and label map exist
2. Ask for your name (optional, for correction metadata)
3. Start an interactive session where you can:
   - Enter transcripts to test
   - Review extracted entities
   - Correct any errors
   - Save corrections for retraining

### Example Session

```
=== EXTRACTION RESULTS - Review and correct if needed ===
Index  Token                          Predicted Tag
0      surgery                        O
1      date                           O
2      january                        >>> B-DATE <<<
3      15th                           >>> I-DATE <<<
4      2025                           >>> I-DATE <<<

Manually correct any tags that are wrong.
Enter corrections as: index:NEW_TAG (e.g., '2:B-DATE' or '2:O')
Type 'done' when finished, 'skip' to keep predictions, 'list' to see available tags

Enter correction: 0:B-PROCEDURE
Updated token 0 ('surgery') from O to B-PROCEDURE
Enter correction: 1:I-PROCEDURE
Updated token 1 ('date') from O to I-PROCEDURE
Enter correction: done

Save these corrections for retraining?
Enter 'yes' to save, anything else to skip: yes
✓ Correction saved successfully!
  File: data/labels/corrections.jsonl
  Tokens: 5
  Entities: 4
```

## File Locations

- **Corrections**: Saved to `data/labels/corrections.jsonl`
- **Label Map**: Read from `data/label_map.json`
- **Original Training Data**: `data/labels/train.jsonl`
- **Merged Data**: `data/labels/train_corrected.jsonl` (created by CorrectionManager)
- **Analysis Report**: `corrections_report.json` (created by CorrectionManager)

## Components

### NERInteractiveTester

Main class for testing and correcting NER predictions.

**Key Methods:**

- `extract_and_display(transcript)` - Extract entities and show them to user
- `collect_corrections(tokens, predicted_tags)` - Interactively get user corrections
- `save_correction(tokens, corrected_tags, metadata)` - Save corrected data to JSONL
- `test_and_correct(transcript, user_name)` - Complete workflow for one transcript
- `interactive_session(user_name)` - Multi-transcript interactive session

**Example Usage:**

```python
from extractor.ner_interactive_tester import NERInteractiveTester
from extractor.base_ner import NERConfig

# Create configuration
config = NERConfig(
    model_type='slot-filling',
    model_dir='models/slot_model',
    device='cpu'
)

# Initialize tester
tester = NERInteractiveTester(config)

# Test a single transcript
transcript = "surgery date was january 15th 2025 surgeon was doctor smith"
tester.test_and_correct(transcript, user_name="john_doe")

# Or start an interactive session
tester.interactive_session(user_name="john_doe")
```

### CorrectionManager

Manages correction files, validation, analysis, and merging with training data.

**Key Methods:**

- `load_jsonl_file(filepath)` - Load JSONL training data
- `save_jsonl_file(filepath, records)` - Save records to JSONL
- `merge_corrections(correction_file, output_file, deduplicate)` - Merge corrections with training data
- `validate_corrections(correction_file)` - Validate correction file format
- `analyze_corrections(correction_file)` - Analyze correction patterns
- `export_corrections_report(...)` - Generate detailed analysis report

**Example Usage:**

```python
from extractor.correction_manager import CorrectionManager

# Initialize manager
manager = CorrectionManager(data_dir='data/labels')

# Validate corrections
validation = manager.validate_corrections()
print(f"Valid records: {validation['valid_records']}/{validation['total_records']}")

# Analyze patterns
analysis = manager.analyze_corrections()
print(f"Most common tags: {analysis['most_common_tags']}")

# Merge with training data
manager.merge_corrections(
    correction_file='corrections.jsonl',
    output_file='train_corrected.jsonl',
    deduplicate=True
)

# Export report
manager.export_corrections_report()
```

## Available Tags

Tags are loaded from `data/label_map.json`. Use the `list` command during correction to see all available tags.

Example tags:
- `O` - Outside (no entity)
- `B-DATE` - Begin date
- `I-DATE` - Inside date (continuation)
- `B-PROCEDURE` - Begin procedure
- `I-PROCEDURE` - Inside procedure
- `B-PERSON_SURGEON` - Begin surgeon name
- `I-PERSON_SURGEON` - Inside surgeon name
- ... and more

## Workflow: From Testing to Retraining

### Step 1: Collect Corrections

```bash
python extractor/test_and_correct_ner.py
```

This creates `data/labels/corrections.jsonl` with your corrections.

### Step 2: Validate Corrections

```python
from extractor.correction_manager import CorrectionManager

manager = CorrectionManager()
validation = manager.validate_corrections()

if validation['issues']:
    print(f"Found {len(validation['issues'])} issues")
    for issue in validation['issues']:
        print(f"  {issue}")
```

### Step 3: Analyze Patterns

```python
analysis = manager.analyze_corrections()
print(f"Total corrections: {analysis['total_correction_records']}")
print(f"Contributors: {analysis['unique_correctors']}")
print(f"Most common tags: {analysis['most_common_tags']}")
```

### Step 4: Merge with Training Data

```python
# This backs up and merges
manager.merge_corrections(
    correction_file='corrections.jsonl',
    output_file='train_corrected.jsonl'
)
```

This creates `data/labels/train_corrected.jsonl` with original + corrections.

### Step 5: Retrain Model

Modify `train/train_token_classifier.py` to use `train_corrected.jsonl`:

```python
# Change this line in train_token_classifier.py:
ds = load_dataset('json', data_files={
    'train': 'data/labels/train_corrected.jsonl',  # Use corrected data
    'test': 'data/labels/dev.jsonl'
})

# Then run training
python train/train_token_classifier.py
```

## Data Format

Corrections are saved as JSONL (JSON Lines) files.

**Format:**
```json
{"tokens": ["word1", "word2", "word3"], "tags": ["O", "B-DATE", "I-DATE"], "metadata": {"corrected_at": "2025-02-11T...", "corrected_by": "john_doe"}}
```

**Important:**
- Length of `tokens` must equal length of `tags`
- All tags must be in `data/label_map.json`
- BIO scheme (not IOB):
  - `B-LABEL` = beginning of new entity
  - `I-LABEL` = inside/continuing entity
  - `O` = outside any entity

## Troubleshooting

### Model not found

```
ERROR: Model directory not found at models/slot_model
```

**Solution:** Train the model first using `python train/train_token_classifier.py`

### Label map not found

```
ERROR: Label map not found at data/label_map.json
```

**Solution:** Ensure `data/label_map.json` exists with proper format

### Invalid tags in corrections

If you use a tag not in the label map, you'll be warned:

```
WARNING: Found invalid tags: {'UNKNOWN-TAG'}
Continue anyway? (yes/no): 
```

Type `yes` to continue or `no` to cancel. **Recommended:** Fix the tag first using `list` command.

### Token-tag mismatch

```
ERROR: Token and tag count mismatch (5 tokens vs 4 tags)
```

**Solution:** Ensure every token gets exactly one tag. Use `O` for tokens outside entities.

## Tips for Effective Correction

1. **Start with high-confidence errors** - Focus on obvious mistakes first
2. **Use the list command** - Type `list` to see available tags
3. **Add metadata** - Your name helps track who made corrections
4. **Review before saving** - Check the summary before confirming save
5. **Batch process** - Session can handle multiple transcripts
6. **Export report** - Use `corrections_report.json` for analysis

## Environment Variables

Optional: Set these before running

```bash
# Use GPU for faster extraction
export CUDA_VISIBLE_DEVICES=0

# Control logging
export LOG_LEVEL=DEBUG
```

## Performance Notes

- **CPU** - Slower but works on any machine
- **GPU** - Much faster if available (set device='cuda')
- **Batch processing** - Can process multiple items in series within one session

## FAQ

**Q: Can I correct metadata tags?**
A: Yes, corrections are optional. Your username and timestamp are automatically added.

**Q: Will corrections overwrite training data?**
A: No, original remains unchanged. Corrections are merged into a new file.

**Q: How many corrections do I need?**
A: Even adding 20-50 corrections can improve model performance.

**Q: Can I use this for active learning?**
A: Yes! Collect corrections, retrain, test on hard cases, repeat.

## Related Files

- `extractor/ner_interactive_tester.py` - Core tester class
- `extractor/correction_manager.py` - Correction file management
- `extractor/test_and_correct_ner.py` - Entry point script
- `extractor/ner_factory.py` - NER model factory
- `extractor/model_infer.py` - Slot filling extractor
- `train/train_token_classifier.py` - Training script
