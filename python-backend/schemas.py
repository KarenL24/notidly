from typing import List

from pydantic import BaseModel, HttpUrl


class TranscribeRequest(BaseModel):
    audioUrl: HttpUrl
    title: str = "Untitled"


class PitchGroup(BaseModel):
    startSec: float
    endSec: float
    midi: int
    note: str
    confidence: float


class TranscribeResponse(BaseModel):
    xml: str
    title: str
    tempoBpm: int
    warnings: List[str]
    pitchGroups: List[PitchGroup]
