import json
import os
import sys
import argparse
import torch
from datasets import load_dataset
from transformers import AutoTokenizer, AutoModelForTokenClassification, TrainingArguments, Trainer

# Fix Windows encoding for Unicode characters
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def load_labels(path):
    with open(path, "r") as f:
        label_list = json.load(f)
    label2id = {l:i for i,l in enumerate(label_list)}
    id2label = {i:l for l,i in label2id.items()}
    return label_list, label2id, id2label

def create_dev_from_train():
    """Split train.jsonl into train (80%) and dev (20%) if dev doesn't exist."""
    train_path = "data/labels/train.jsonl"
    dev_path = "data/labels/dev.jsonl"
    
    # If dev.jsonl already exists, don't overwrite
    if os.path.exists(dev_path):
        return
    
    # Read all examples from train.jsonl
    examples = []
    with open(train_path, "r") as f:
        for line in f:
            if line.strip():
                examples.append(json.loads(line))
    
    if not examples:
        print("[WARNING] No training examples found in train.jsonl", flush=True)
        return
    
    # Split 80/20
    split_idx = int(len(examples) * 0.8)
    train_examples = examples[:split_idx]
    dev_examples = examples[split_idx:]
    
    # Write back train.jsonl (80%)
    with open(train_path, "w") as f:
        for ex in train_examples:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")
    
    # Write dev.jsonl (20%)
    with open(dev_path, "w") as f:
        for ex in dev_examples:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")
    
    print(f"[OK] Split data: {len(train_examples)} train, {len(dev_examples)} validation", flush=True)

def main(base_model="distilbert-base-uncased", resume_from=None, epochs=5, batch_size=8, learning_rate=2e-5, max_length=512, output_dir="models/slot_model", train_full_model=False):
    # Disable CUDA before anything else
    import os
    os.environ['CUDA_VISIBLE_DEVICES'] = ''
    torch.cuda.is_available = lambda: False
    
    # Ensure dev.jsonl exists
    create_dev_from_train()
    
    # Force CPU usage
    device = torch.device("cpu")
    print(f"[DEVICE] Using device: {device}", flush=True)
    
    # Determine which model to load from
    model_path = resume_from if resume_from else base_model
    is_incremental = resume_from is not None
    
    if is_incremental:
        print(f"[MODE] Incremental training - continuing from: {resume_from}", flush=True)
        # For incremental training, use lower learning rate by default
        if learning_rate >= 2e-5:
            learning_rate = learning_rate / 5  # Reduce LR for fine-tuning
            print(f"[CONFIG] Reduced learning_rate to {learning_rate} for incremental training", flush=True)
    else:
        print(f"[MODE] Training from scratch using base model: {base_model}", flush=True)
    
    # Reduce batch size for CPU training to avoid memory issues
    if batch_size > 2:
        batch_size = 2
        print(f"[CONFIG] Reduced batch_size to {batch_size} for CPU training", flush=True)
    
    # Reduce max_length for CPU training to save memory
    if max_length > 256:
        max_length = 256
        print(f"[CONFIG] Reduced max_length to {max_length} for CPU training", flush=True)
    
    print(f"[CONFIG] model={model_path}, epochs={epochs}, batch_size={batch_size}, lr={learning_rate}, max_len={max_length}", flush=True)
    
    label_list, label2id, id2label = load_labels("data/label_map.json")
    print(f"[LABELS] Loaded {len(label_list)} labels from label_map.json", flush=True)

    print("[DATASET] Loading dataset...", flush=True)
    ds = load_dataset("json", data_files={
        "train": "data/labels/train.jsonl",
        "validation": "data/labels/dev.jsonl"
    })
    print(f"[OK] Dataset loaded: {len(ds['train'])} train, {len(ds['validation'])} validation", flush=True)

    print("[TOKENIZER] Loading tokenizer...", flush=True)
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    print("[OK] Tokenizer loaded", flush=True)

    def encode(example):
        tok = tokenizer(
            example["tokens"], 
            is_split_into_words=True, 
            truncation=True,
            max_length=max_length,
            padding="max_length"
        )
        word_ids = tok.word_ids()
        labels = []
        prev = None
        for w in word_ids:
            if w is None:
                labels.append(-100)
            elif w != prev:
                labels.append(label2id[example["tags"][w]])
            else:
                labels.append(label2id[example["tags"][w]])
            prev = w
        tok["labels"] = labels
        return tok

    print("[ENCODE] Tokenizing dataset...", flush=True)
    ds_tok = ds.map(encode)
    print("[OK] Dataset tokenized", flush=True)

    print(f"[MODEL] Loading model: {model_path}...", flush=True)
    
    # Load model with CPU-only settings
    try:
        import warnings
        warnings.filterwarnings('ignore')
        
        model = AutoModelForTokenClassification.from_pretrained(
            model_path,
            num_labels=len(label_list),
            id2label=id2label,
            label2id=label2id,
            device_map=None,  # Don't auto device map
            low_cpu_mem_usage=False  # Use standard memory usage
        )
        model = model.to(device)  # Explicitly move to CPU
        
        # Decide whether to freeze base model
        if train_full_model or is_incremental:
            # For incremental training, train the full model for better adaptation
            print("[OPTIMIZE] Training FULL model (all parameters)", flush=True)
        else:
            # CRITICAL: Freeze base model, only train classifier head
            print("[OPTIMIZE] Freezing base model, training only classifier head", flush=True)
            for param in model.distilbert.parameters():
                param.requires_grad = False
        
        # Count trainable parameters
        trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
        total_params = sum(p.numel() for p in model.parameters())
        print(f"[MODEL] Trainable params: {trainable_params:,} / Total params: {total_params:,}", flush=True)
        
        print("[OK] Model loaded and moved to CPU", flush=True)
    except Exception as e:
        print(f"[ERROR] Failed to load model: {e}", flush=True)
        raise

    # Adjust learning rate multiplier based on training mode
    lr_multiplier = 1 if (train_full_model or is_incremental) else 10
    
    args = TrainingArguments(
        output_dir=output_dir,
        learning_rate=learning_rate * lr_multiplier,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=max(1, batch_size // 2),  # Even smaller eval batch
        num_train_epochs=epochs,
        weight_decay=0.01,
        eval_strategy="epoch",
        save_strategy="epoch",
        no_cuda=True,  # Force CPU usage
        use_cpu=True,  # Explicitly use CPU
        dataloader_pin_memory=False,  # Disable pin_memory
        report_to="none",  # Don't report to wandb
        dataloader_num_workers=0,  # Disable multiprocessing for data loading
        gradient_accumulation_steps=1,  # No accumulation needed for small batches
        optim="adamw_torch",  # Use memory-efficient optimizer
        max_grad_norm=1.0,  # Clip gradients
        logging_steps=1,  # Log every step for visibility
    )

    print("[TRAINER] Initializing trainer...", flush=True)
    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=ds_tok["train"],
        eval_dataset=ds_tok["validation"]
    )

    print("[TRAIN] Starting training...", flush=True)
    try:
        import gc
        gc.collect()  # Clear memory before training
        trainer.train()
    except RuntimeError as e:
        if 'out of memory' in str(e).lower():
            print("[ERROR] Out of memory - try reducing batch_size or max_length further", flush=True)
        raise
    
    print("[SAVE] Saving model...", flush=True)
    trainer.save_model(output_dir)
    tokenizer.save_pretrained(output_dir)
    print(f"[OK] Training completed! Model saved to {output_dir}", flush=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Train NER Token Classification Model')
    parser.add_argument('--base_model', type=str, default='distilbert-base-uncased', help='Base model name')
    parser.add_argument('--resume_from', type=str, default=None, help='Path to existing fine-tuned model to continue training from (e.g., models/slot_model)')
    parser.add_argument('--epochs', type=int, default=5, help='Number of training epochs')
    parser.add_argument('--batch_size', type=int, default=8, help='Training batch size')
    parser.add_argument('--learning_rate', type=float, default=2e-5, help='Learning rate')
    parser.add_argument('--max_length', type=int, default=512, help='Max sequence length')
    parser.add_argument('--output_dir', type=str, default='models/slot_model', help='Output directory')
    parser.add_argument('--train_full_model', action='store_true', help='Train full model instead of just classifier head (slower but better for incremental)')
    
    args = parser.parse_args()
    
    try:
        main(
            base_model=args.base_model,
            resume_from=args.resume_from,
            epochs=args.epochs,
            batch_size=args.batch_size,
            learning_rate=args.learning_rate,
            max_length=args.max_length,
            output_dir=args.output_dir,
            train_full_model=args.train_full_model
        )
    except Exception as e:
        print(f"[ERROR] Training failed with error: {e}", flush=True)
        import traceback
        traceback.print_exc()
        exit(1)
