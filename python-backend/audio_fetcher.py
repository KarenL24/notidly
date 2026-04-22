from urllib.request import Request, urlopen


def fetch_audio_bytes(audio_url: str, timeout_seconds: int = 20) -> bytes:
    req = Request(audio_url, headers={"User-Agent": "notidly-mock-backend/0.1"})
    with urlopen(req, timeout=timeout_seconds) as response:
        return response.read()
