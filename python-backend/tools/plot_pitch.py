from __future__ import annotations

import argparse
from pathlib import Path

import librosa
import matplotlib.pyplot as plt
import numpy as np


def main() -> None:
    parser = argparse.ArgumentParser(description="Plot vocal pitch track from an audio file.")
    parser.add_argument("audio_path", help="Path to input MP3/WAV file")
    parser.add_argument(
        "--out",
        default="pitch_track.png",
        help="Output PNG path (default: pitch_track.png)",
    )
    args = parser.parse_args()

    audio_path = Path(args.audio_path).expanduser().resolve()
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file does not exist: {audio_path}")

    y, sr = librosa.load(audio_path, sr=22050, mono=True)
    f0, _, _ = librosa.pyin(
        y,
        sr=sr,
        fmin=librosa.note_to_hz("C2"),
        fmax=librosa.note_to_hz("C6"),
        frame_length=2048,
        hop_length=256,
    )
    times = librosa.times_like(f0, sr=sr, hop_length=256)

    plt.figure(figsize=(12, 4))
    plt.plot(times, f0, linewidth=1.2)
    plt.title(f"Pitch Track: {audio_path.name}")
    plt.xlabel("Time (s)")
    plt.ylabel("Frequency (Hz)")
    plt.ylim([60, 1000])
    plt.grid(alpha=0.25)
    plt.tight_layout()
    plt.savefig(args.out, dpi=150)

    voiced = int(np.count_nonzero(~np.isnan(f0)))
    print(f"Saved pitch graph to {args.out}")
    print(f"Voiced frames: {voiced}/{len(f0)}")


if __name__ == "__main__":
    main()
