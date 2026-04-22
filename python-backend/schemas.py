from typing import List

from pydantic import BaseModel, HttpUrl


class TranscribeRequest(BaseModel):
    audioUrl: HttpUrl
    title: str = "Untitled"


class TranscribeResponse(BaseModel):
    xml: str
    title: str
    tempoBpm: int
    warnings: List[str]
