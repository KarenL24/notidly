# Python Backend

## Request flow

1. User uploads audio (MP3/WAV) in the Next.js app.
2. Next.js calls FastAPI `POST /api/transcribe` with an `audioUrl`.
3. FastAPI downloads the audio bytes.
4. `librosa.pyin` extracts frame-level pitches.
5. Pitches are smoothed and grouped into note events.
6. `music21` converts note events to MusicXML.
7. API returns `xml`, `tempoBpm`, `warnings`, and `pitchGroups`.

## Endpoints

- `GET /health` -> `{"ok": true}`
- `POST /api/transcribe` -> real transcription response

## Local run

```bash
cd python-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

## Quick librosa verification (4/23)

```bash
cd python-backend
python tools/plot_pitch.py "/absolute/path/to/vocal.mp3" --out pitch_track.png
```

If this generates a clear pitch contour image, local `librosa` is working on your clean sample.

## Slim Docker image (4/27)

```bash
cd python-backend
docker build -t notidly-transcriber:slim .
docker run --rm -p 8000:8000 notidly-transcriber:slim
```
