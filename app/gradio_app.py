# app/streamlit_app.py
import json
import os
import sys
import tempfile
from datetime import datetime
from typing import Any, Dict, List, Tuple, Optional

import streamlit as st
import librosa
import numpy as np

# -----------------------------------------------------------------------------
# PATH FIX
# -----------------------------------------------------------------------------
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from stt.stt_whisper import STT
from extractor.model_infer import SlotFillingExtractor

# -----------------------------------------------------------------------------
# CONFIG
# -----------------------------------------------------------------------------
STT_LANG = "en"
MODEL_DIR = os.path.join(PROJECT_ROOT, "models", "slot_model")

OUTPUTS_DIR = os.path.join(PROJECT_ROOT, "data", "outputs")
LABELS_DIR = os.path.join(PROJECT_ROOT, "data", "labels")
OUTPUTS_PATH = os.path.join(OUTPUTS_DIR, "extracted.jsonl")
LABELS_PATH = os.path.join(LABELS_DIR, "train.jsonl")


# -----------------------------------------------------------------------------
# LOAD MODELS
# -----------------------------------------------------------------------------
@st.cache_resource
def load_stt() -> STT:
    return STT(model_name="base", device="cpu", compute_type="int8")


@st.cache_resource
def load_extractor() -> Optional[SlotFillingExtractor]:
    if os.path.exists(MODEL_DIR) and os.path.isdir(MODEL_DIR):
        return SlotFillingExtractor(MODEL_DIR)
    return None


stt = load_stt()
extractor = load_extractor()


# -----------------------------------------------------------------------------
# HELPERS
# -----------------------------------------------------------------------------
def tokenize(text: str) -> List[str]:
    return text.strip().split() if text and text.strip() else []


def _ensure_mono(y: np.ndarray) -> np.ndarray:
    if y.ndim == 1:
        return y
    # librosa with mono=False can return (channels, n)
    return np.mean(y, axis=0)


def streamlit_audio_to_sr_y(audio_file) -> Tuple[int, np.ndarray]:
    audio_bytes = audio_file.getvalue()
    if not audio_bytes:
        raise ValueError("Empty audio bytes")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        y, sr = librosa.load(tmp_path, sr=None, mono=False)
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass

    y = _ensure_mono(np.asarray(y, dtype=np.float32))
    return sr, y


def transcribe_and_extract_from_audio(audio_file):
    if audio_file is None:
        return "", {}, "❌ No audio"

    try:
        sr, y = streamlit_audio_to_sr_y(audio_file)
    except Exception as e:
        return "", {}, f"❌ Failed to load audio: {e}"

    audio_16k = stt.preprocess((sr, y))
    if audio_16k is None:
        return "", {}, "❌ No audio after preprocessing"

    transcript = stt.transcribe(audio_16k, language=STT_LANG).strip()
    if not transcript:
        return "", {}, "❌ Empty transcript (STT returned nothing). Try speaking louder/closer."

    if extractor is None:
        return transcript, {}, "⚠️ No trained NLP model found. Train first or add labels."

    try:
        out_json = extractor.extract(transcript)
    except Exception as e:
        return transcript, {}, f"❌ NLP extraction failed: {e}"

    return transcript, out_json, "✅ Extracted JSON"


def save_output_json(transcript: str, json_obj: Dict[str, Any]) -> str:
    os.makedirs(OUTPUTS_DIR, exist_ok=True)
    rec = {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "transcript": transcript,
        "json": json_obj,
    }
    with open(OUTPUTS_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    return f"✅ Saved to {OUTPUTS_PATH}"


def save_labels_from_strings(transcript: str, tags_str: str) -> str:
    os.makedirs(LABELS_DIR, exist_ok=True)
    tokens = tokenize(transcript)
    tags = tags_str.strip().split() if tags_str and tags_str.strip() else []

    if not tokens:
        return "❌ Transcript is empty; nothing to label."
    if len(tags) != len(tokens):
        return f"❌ Invalid tags: you provided {len(tags)} tags but there are {len(tokens)} tokens."

    rec = {"tokens": tokens, "tags": tags}
    with open(LABELS_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    return f"✅ Added 1 training example to {LABELS_PATH}"


# -----------------------------------------------------------------------------
# STREAMLIT UI
# -----------------------------------------------------------------------------
def init_state():
    # These keys are the widget keys. They must exist BEFORE widgets render.
    st.session_state.setdefault("transcript_area", "")
    st.session_state.setdefault("json_area", "{}")
    st.session_state.setdefault("tags_area", "")

    # Non-widget state
    st.session_state.setdefault("status", "")
    st.session_state.setdefault("out_json", {})


def main():
    init_state()

    st.title("OR Voice → JSON (Streamlit)")

    st.header("1) Record audio then extract JSON")
    audio_file = st.audio_input("Click the microphone to record")

    col1, col2 = st.columns([1, 1])
    with col1:
        run = st.button("Transcribe + Extract")
    with col2:
        clear = st.button("Clear")

    if clear:
        st.session_state["transcript_area"] = ""
        st.session_state["out_json"] = {}
        st.session_state["json_area"] = "{}"
        st.session_state["tags_area"] = ""
        st.session_state["status"] = ""

    if run:
        transcript, out_json, status = transcribe_and_extract_from_audio(audio_file)

        # ✅ IMPORTANT: write results into the WIDGET KEYS
        st.session_state["transcript_area"] = transcript
        st.session_state["out_json"] = out_json
        st.session_state["json_area"] = json.dumps(out_json, ensure_ascii=False, indent=2)
        st.session_state["status"] = status

        toks = tokenize(transcript)
        st.session_state["tags_area"] = " ".join(["O"] * len(toks)) if toks else ""

        # optional: force immediate redraw
        st.rerun()

    if st.session_state["status"]:
        if st.session_state["status"].startswith("✅"):
            st.success(st.session_state["status"])
        elif st.session_state["status"].startswith("⚠️"):
            st.warning(st.session_state["status"])
        else:
            st.error(st.session_state["status"])

    st.subheader("Transcript")
    st.text_area("Transcript (editable)", height=120, key="transcript_area")

    st.subheader("Extracted JSON (editable)")
    st.text_area("JSON (edit before save)", height=260, key="json_area")

    st.header("2) Save the (edited) JSON output")
    if st.button("Save JSON Output"):
        transcript_to_save = st.session_state["transcript_area"].strip()
        json_text_to_save = st.session_state["json_area"].strip()

        if not transcript_to_save:
            st.error("❌ Transcript is empty. Transcribe first or type a transcript.")
        else:
            try:
                parsed = json.loads(json_text_to_save) if json_text_to_save else {}
                msg = save_output_json(transcript_to_save, parsed)
                st.success(msg)
            except json.JSONDecodeError as e:
                st.error(f"❌ Invalid JSON: {e}")

    st.header("3) Add training data (BIO tags)")
    st.write("Tokens are generated from the transcript. Provide **one tag per token**, separated by spaces.")

    tokens = tokenize(st.session_state["transcript_area"])
    if tokens:
        st.write("Tokens:")
        st.code(tokens)

        st.text_area("Enter BIO tags (space separated)", height=120, key="tags_area")

        if st.button("Save labels to train.jsonl"):
            msg = save_labels_from_strings(st.session_state["transcript_area"], st.session_state["tags_area"])
            if msg.startswith("✅"):
                st.success(msg)
            else:
                st.error(msg)
    else:
        st.info("Record audio (or type transcript) to generate tokens for labeling.")


if __name__ == "__main__":
    main()
