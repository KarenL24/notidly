from fastapi import FastAPI
from schemas import TranscribeRequest, TranscribeResponse
from transcription_pipeline import transcribe_from_request


app = FastAPI(title="Notidly Transcription API", version="0.2.0")


@app.get("/health")
def health_check() -> dict:
    return {"ok": True}


@app.post("/api/transcribe", response_model=TranscribeResponse)
def transcribe_audio(payload: TranscribeRequest) -> TranscribeResponse:
    return transcribe_from_request(payload)
