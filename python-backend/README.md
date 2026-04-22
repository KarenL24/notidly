# Python Backend (Mock)

## Request flow

1. User uploads WAV in the Next.js app.
2. Next.js uploads the file to Vercel Blob.
3. Next.js calls FastAPI `POST /api/transcribe` with an `audioUrl`.
4. FastAPI downloads audio bytes from that URL.
5. FastAPI returns fake MusicXML and metadata.

## Endpoints

- `GET /health` -> `{"ok": true}`
- `POST /api/transcribe` -> mocked transcription response

## Files

- `main.py`: FastAPI routes.
- `schemas.py`: request/response models.
- `audio_fetcher.py`: downloads audio bytes from URL.
- `musicxml_template.py`: fake MusicXML output.
- `transcription_pipeline.py`: pipeline (`audio URL -> bytes -> XML`).
