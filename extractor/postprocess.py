# extractor/postprocess.py

import re
from dateutil import parser as dateparser

from .schema import ORFormJSON, Medication

# -----------------------------
# Helpers: numbers / parsing
# -----------------------------
def _first_int(s: str):
    m = re.search(r"\d+", s)
    return int(m.group()) if m else None


def _first_float(s: str):
    m = re.search(r"\d+(\.\d+)?", s)
    return float(m.group()) if m else None


def normalize_date(text: str):
    try:
        dt = dateparser.parse(text, dayfirst=True)
        return dt.date().isoformat() if dt else None
    except Exception:
        return None


def normalize_time(text: str):
    # basic normalization for model spans (keeps original text-ish)
    t = text.lower().strip()
    t = t.replace(".", ":")
    t = re.sub(r"\s+", " ", t)
    return t


# -----------------------------
# Cleaning & span join
# -----------------------------
def clean_transcript(t: str) -> str:
    t = (t or "").strip()
    t = t.replace("p.m.", "pm").replace("a.m.", "am")
    t = t.replace("p.m", "pm").replace("a.m", "am")
    t = re.sub(r"[,\.;]+", " ", t)  # remove punctuation noise
    t = re.sub(r"\s+", " ", t).strip()
    return t


def join_clean(words) -> str:
    """
    Join word pieces coming from token classifier, removing pure punctuation tokens.
    """
    if not words:
        return ""
    return " ".join(w for w in words if re.search(r"[A-Za-z0-9]", w)).strip()


# -----------------------------
# Slot-number detector (optional)
# -----------------------------
def detect_slot_number(text: str, role: str) -> int:
    """
    role examples: 'surgeon', 'assistant'
    Returns 1 or 2 (default 1)
    """
    t = (text or "").lower()

    if re.search(rf"\b{role}\s*(1|one)\b", t) or re.search(rf"\b(first)\s+{role}\b", t):
        return 1
    if re.search(rf"\b{role}\s*(2|two)\b", t) or re.search(rf"\b(second)\s+{role}\b", t):
        return 2
    return 1


# -----------------------------
# Rule-based: surgeons
# -----------------------------
def extract_surgeons_from_text(t: str) -> dict:
    """
    Returns {"surgeon_1": "...", "surgeon_2": "..."} if found.
    """
    t = clean_transcript(t).lower()

    # normalize common phrases
    t = t.replace("surgeon one", "surgeon 1").replace("first surgeon", "surgeon 1")
    t = t.replace("surgeon two", "surgeon 2").replace("second surgeon", "surgeon 2")

    out = {"surgeon_1": None, "surgeon_2": None}

    def grab(slot_num: int):
        # capture after "surgeon 1" until next surgeon/in/out/end OR end of string
        pattern = rf"(?:^|\b)surgeon\s*{slot_num}\b\s+(.*?)(?=\bsurgeon\b|\bin\b|\bout\b|\bend\b|$)"
        m = re.search(pattern, t)
        if not m:
            return None

        val = m.group(1).strip()
        # remove titles at the start
        val = re.sub(r"^(dr|doctor)\b\s*", "", val).strip()

        # keep only name-like tokens
        tokens = [w for w in val.split() if re.fullmatch(r"[a-z\-]+", w)]
        if not tokens:
            return None
        return " ".join(tokens)

    out["surgeon_1"] = grab(1)
    out["surgeon_2"] = grab(2)
    return out


# -----------------------------
# Rule-based: times (in/out)
# -----------------------------
def normalize_time_simple(raw: str) -> str:
    """
    Turns '930 pm' -> '9:30 pm', '0530 am' -> '5:30 am', '9:30 pm' stays.
    """
    raw = (raw or "").strip().lower().replace(".", "")
    raw = re.sub(r"\s+", " ", raw)

    # 9:30 pm
    m = re.search(r"\b(\d{1,2}):(\d{2})\s*(am|pm)\b", raw)
    if m:
        return f"{int(m.group(1))}:{m.group(2)} {m.group(3)}"

    # 930 pm or 0530 am
    m = re.search(r"\b(\d{3,4})\s*(am|pm)\b", raw)
    if m:
        digits, mer = m.group(1), m.group(2)
        if len(digits) == 3:
            h, mi = int(digits[0]), digits[1:]
        else:
            h, mi = int(digits[:2]), digits[2:]
        h = int(h)  # ensure no leading zeros
        return f"{h}:{mi} {mer}"

    return raw


def extract_time_from_text(t: str, keyword: str) -> str | None:
    """
    Generic extractor for 'in'/'out' patterns:
      - "in 930 pm"
      - "in 9:30 pm"
      - "930 pm in"
    """
    t = clean_transcript(t).lower()

    # "out 530 am"
    m = re.search(rf"\b{keyword}\b\s+(\d{{1,2}}:\d{{2}}\s*(?:am|pm)|\d{{3,4}}\s*(?:am|pm))", t)
    if m:
        return normalize_time_simple(m.group(1))

    # "530 am out"
    m = re.search(rf"(\d{{1,2}}:\d{{2}}\s*(?:am|pm)|\d{{3,4}}\s*(?:am|pm))\s+\b{keyword}\b", t)
    if m:
        return normalize_time_simple(m.group(1))

    return None


def extract_in_time_from_text(t: str) -> str | None:
    return extract_time_from_text(t, "in")


def extract_out_time_from_text(t: str) -> str | None:
    return extract_time_from_text(t, "out")


# -----------------------------
# MAIN: entities -> ORFormJSON
# -----------------------------
def decode_entities_to_json(entities, transcript: str) -> dict:
    """
    entities: list of dicts from HF pipeline aggregation_strategy="simple"
    Each entity has: entity_group, word, start, end, score
    """
    form = ORFormJSON()

    # collect text spans per label
    spans = {}
    for e in entities or []:
        label = e.get("entity_group")
        word = e.get("word")
        if not label or word is None:
            continue
        spans.setdefault(label, [])
        spans[label].append(word)

    # Date
    if "DATE" in spans:
        form.date = normalize_date(join_clean(spans["DATE"]))

    # Times from model
    mapping = {
        "TIME_IN": "in",
        "TIME_OUT": "out",
        "TIME_INDUCTION": "induction",
        "TIME_CUTTING": "cutting",
        "TIME_END": "end_of_surgery",
        "TIME_DRESSING": "dressing",
    }
    for k, field in mapping.items():
        if k in spans:
            form.times[field] = normalize_time(join_clean(spans[k]))

    # Personnel from model (clean joins)
    if "PERSON_SURGEON" in spans:
        # if model gives only one surgeon, put it into surgeon_1 by default
        form.personnel["surgeon_1"] = join_clean(spans["PERSON_SURGEON"]) or None

    if "PERSON_ANESTHETIST" in spans:
        form.personnel["anesthetist"] = join_clean(spans["PERSON_ANESTHETIST"]) or None
    if "PERSON_SCRUB" in spans:
        form.personnel["scrub_nurse"] = join_clean(spans["PERSON_SCRUB"]) or None
    if "PERSON_CIRC" in spans:
        form.personnel["circulating_nurse"] = join_clean(spans["PERSON_CIRC"]) or None
    if "PERSON_TECH" in spans:
        form.personnel["anesthesia_technician"] = join_clean(spans["PERSON_TECH"]) or None

    # Diagnosis
    if "DIAG_PRE" in spans:
        form.diagnosis["pre_op"] = join_clean(spans["DIAG_PRE"]) or None
    if "DIAG_POST" in spans:
        form.diagnosis["post_op"] = join_clean(spans["DIAG_POST"]) or None

    # Operation
    if "OP_NAME" in spans:
        form.operation["name"] = join_clean(spans["OP_NAME"]) or None
    if "OP_CODE" in spans:
        form.operation["code"] = join_clean(spans["OP_CODE"]) or None

    # Vitals
    if "BP_SYS" in spans:
        form.vitals["bp_systolic"] = _first_int(join_clean(spans["BP_SYS"]))
    if "BP_DIA" in spans:
        form.vitals["bp_diastolic"] = _first_int(join_clean(spans["BP_DIA"]))
    if "HR" in spans:
        form.vitals["heart_rate"] = _first_int(join_clean(spans["HR"]))
    if "SPO2" in spans:
        form.vitals["spo2"] = _first_int(join_clean(spans["SPO2"]))

    # Anesthesia type
    if "ANES_TYPE" in spans:
        types = join_clean(spans["ANES_TYPE"]).lower()
        for t in ["general", "spinal", "epidural", "local", "regional"]:
            if t in types and t not in form.anesthesia["type"]:
                form.anesthesia["type"].append(t)

    # Position
    if "POSITION" in spans:
        form.position = join_clean(spans["POSITION"]).lower() or None

    # Devices (keywords)
    if "DEVICE" in spans:
        devices = join_clean(spans["DEVICE"]).lower()
        if "foley" in devices:
            form.devices["foley"] = True
        if "irrigation" in devices:
            form.devices["foley_with_irrigation"] = True
        if "hemovac" in devices:
            form.devices["hemovac"] = True
        if "ng" in devices or "ngt" in devices:
            form.devices["ng_tube"] = True
        if "chest" in devices:
            form.devices["chest_tube"] = True

    # Specimen
    if "SPECIMEN" in spans:
        form.specimen["sent"] = True
        spec = join_clean(spans["SPECIMEN"]).lower()
        for t in ["pathology", "culture", "cytology", "frozen", "csf", "stone"]:
            if t in spec and t not in form.specimen["type"]:
                form.specimen["type"].append(t)

    # Condition
    if "CONDITION" in spans:
        form.condition_post_op = join_clean(spans["CONDITION"]).lower() or None

    # Medications (basic single)
    if "DRUG" in spans:
        drug_name = join_clean(spans["DRUG"])
        dose = _first_float(join_clean(spans.get("DOSE", [])))
        unit = join_clean(spans.get("UNIT", [])).replace("##", "").strip() or None
        if drug_name:
            form.medications.append(Medication(name=drug_name, dose=dose, unit=unit))

    # -----------------------------------------
    # RULE-BASED OVERRIDES (more reliable)
    # -----------------------------------------
    surg = extract_surgeons_from_text(transcript)
    if surg.get("surgeon_1"):
        form.personnel["surgeon_1"] = surg["surgeon_1"]
    if surg.get("surgeon_2"):
        form.personnel["surgeon_2"] = surg["surgeon_2"]

    in_time = extract_in_time_from_text(transcript)
    if in_time:
        form.times["in"] = in_time

    out_time = extract_out_time_from_text(transcript)
    if out_time:
        form.times["out"] = out_time

    form.free_notes = (transcript or "").strip()
    return form.model_dump()
