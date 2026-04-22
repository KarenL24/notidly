from audio_fetcher import fetch_audio_bytes
from musicxml_template import build_fake_musicxml
from schemas import TranscribeRequest, TranscribeResponse


def transcribe_from_request(payload: TranscribeRequest) -> TranscribeResponse:
    # Step 1: Download audio via the URL sent by Next.js.
    audio_bytes = fetch_audio_bytes(str(payload.audioUrl))

    # Step 2: Placeholder "analysis" for now.
    _audio_size = len(audio_bytes)

    # Step 3: Produce MusicXML output.
    xml = build_fake_musicxml()

    return TranscribeResponse(
        xml=xml,
        title=payload.title,
        tempoBpm=96,
        warnings=["Mock response: no real transcription performed."],
    )
