from audio_fetcher import fetch_audio_bytes
from musicxml_template import build_fake_musicxml
from schemas import TranscribeRequest, TranscribeResponse


def transcribe_from_request(payload: TranscribeRequest) -> TranscribeResponse:
    warnings = []

    # Step 1: Download audio via the URL sent by Next.js.
    # In hosted environments, temporary URL access can fail; keep mock flow alive.
    try:
        audio_bytes = fetch_audio_bytes(str(payload.audioUrl))
        _audio_size = len(audio_bytes)
    except Exception as exc:
        warnings.append(f"Audio fetch failed in mock backend: {exc}")

    # Step 3: Produce MusicXML output.
    xml = build_fake_musicxml()

    return TranscribeResponse(
        xml=xml,
        title=payload.title,
        tempoBpm=96,
        warnings=["Mock response: no real transcription performed.", *warnings],
    )
