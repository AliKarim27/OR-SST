# AI-OR: Operating Room AI Assistant

AI-OR is an AI-powered assistant designed for operating room environments. It combines speech-to-text (STT) transcription using Whisper and slot filling extraction to process and analyze surgical procedure data from audio recordings.

## Features

- **Speech-to-Text (STT)**: Transcribes audio recordings using OpenAI's Whisper model (via faster-whisper).
- **Slot Filling Extraction**: Uses a fine-tuned BERT-based token classifier to extract structured information from transcribed text, such as dates, times, personnel, diagnoses, and procedures.
- **Web Interface**: React dashboard for uploading audio files and viewing extracted information.
- **Training Pipeline**: Scripts to train custom slot filling models on labeled datasets.

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd Ai-OR
   ```

2. **Create a virtual environment**:
   ```bash
   python -m venv .venv
   # On Windows:
   .venv\Scripts\activate
   # On macOS/Linux:
   source .venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

## Data Preparation

The project uses JSONL files for training data located in `data/labels/`:
- `train.jsonl`: Training examples
- `dev.jsonl`: Validation examples

Each line in the JSONL files should be a JSON object with `tokens` (list of words) and `labels` (list of BIO tags corresponding to the labels in `data/label_map.json`).

If `dev.jsonl` doesn't exist, the training script will automatically split `train.jsonl` into 80% train and 20% dev.

## Training the Model

To train the slot filling model:

1. Ensure your training data is in `data/labels/train.jsonl` and optionally `data/labels/dev.jsonl`.

2. Run the training script:
   ```bash
   python train/train_token_classifier.py
   ```

The trained model will be saved in `models/slot_model/` with checkpoints in subdirectories.

### Training Configuration

The training script uses:
- Base model: BERT (bert-base-uncased)
- Task: Token Classification
- Training arguments: 3 epochs, batch size 16, learning rate 2e-5
- Evaluation metric: seqeval (precision, recall, F1 for each label)

You can modify `train/train_token_classifier.py` to adjust hyperparameters or model architecture.

## Running the Application

1. **Start the React dashboard**:
   ```bash
   cd react-material-ui
   npm install
   npm start
   ```

2. **Access the interface**:
   Open your browser to `http://localhost:3000`

### Usage

1. **Upload Audio**: Use the dashboard workflow to select an audio file (WAV, MP3, etc.).
2. **Transcribe**: The app will transcribe the audio using Whisper.
3. **Extract Information**: The slot filling model will process the transcript and extract structured data.
4. **View Results**: See the extracted entities in a structured format.

## Project Structure

```
Ai-OR/
├── data/
│   ├── label_map.json         # Label definitions for slot filling
│   └── labels/
│       ├── train.jsonl        # Training data
│       └── dev.jsonl          # Validation data
├── extractor/
│   ├── model_infer.py         # Slot filling inference
│   ├── postprocess.py         # Post-processing utilities
│   └── schema.py              # Data schemas
├── models/
│   └── slot_model/            # Trained slot filling model
├── stt/
│   └── stt_whisper.py         # Whisper-based STT
├── train/
│   └── train_token_classifier.py  # Training script
├── react-material-ui/         # React dashboard UI
├── requirements.txt           # Python dependencies
└── README.md                  # This file
```

## Dependencies

Key libraries:
- `faster-whisper`: Efficient Whisper implementation
- `transformers`: Hugging Face transformers for slot filling
- `torch`: PyTorch for model training/inference
- `librosa`: Audio processing
- `datasets`: Data loading utilities

Frontend dependencies live in `react-material-ui/package.json`.

## Model Details

- **STT Model**: Whisper base model (English)
- **Slot Filling Model**: BERT-base-uncased fine-tuned for token classification
- **Labels**: 40+ entity types including dates, times, personnel, diagnoses, procedures, vital signs, etc.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

[Add your license here]

## Contact

[Add contact information]