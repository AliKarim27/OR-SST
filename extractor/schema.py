from pydantic import BaseModel, Field
from typing import Optional, List


class Medication(BaseModel):
    name: str
    dose: Optional[float] = None
    unit: Optional[str] = None


class ORFormJSON(BaseModel):
    date: Optional[str] = Field(None, description="YYYY-MM-DD")

    times: dict = Field(default_factory=lambda: {
        "in": None,
        "out": None,
        "induction": None,
        "cutting": None,
        "end_of_surgery": None,
        "dressing": None
    })

    personnel: dict = Field(default_factory=lambda: {
        "surgeon_1": None,
        "surgeon_2": None,
        "assistant_1": None,
        "assistant_2": None,
        "anesthetist": None,
        "scrub_nurse": None,
        "circulating_nurse": None,
        "anesthesia_technician": None
    })

    diagnosis: dict = Field(default_factory=lambda: {
        "pre_op": None,
        "post_op": None
    })

    operation: dict = Field(default_factory=lambda: {
        "name": None,
        "code": None,
        "notes": None
    })

    anesthesia: dict = Field(default_factory=lambda: {
        "type": [],
        "sedation": None
    })

    position: Optional[str] = None

    devices: dict = Field(default_factory=lambda: {
        "foley": False,
        "foley_with_irrigation": False,
        "hemovac": False,
        "ng_tube": False,
        "chest_tube": False,
        "others": []
    })

    specimen: dict = Field(default_factory=lambda: {
        "sent": False,
        "type": []
    })

    condition_post_op: Optional[str] = None

    vitals: dict = Field(default_factory=lambda: {
        "bp_systolic": None,
        "bp_diastolic": None,
        "heart_rate": None,
        "spo2": None
    })

    medications: List[Medication] = Field(default_factory=list)
    free_notes: str = ""
