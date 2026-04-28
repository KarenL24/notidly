from __future__ import annotations

from io import BytesIO
import tempfile
from typing import List, Optional, Tuple

import librosa
import music21
import numpy as np

from audio_fetcher import fetch_audio_bytes
from schemas import PitchGroup, TranscribeRequest, TranscribeResponse


FRAME_HOP_SECONDS = 0.012
MAX_INTERPOLATED_GAP_FRAMES = 9
MIN_NOTE_FRAMES = 1
MIN_NOTE_SEC = 0.02
MAX_GAP_FILL_SEC = 0.35
NEAR_PITCH_SEMITONES = 3
SEMITONE_WOBBLE_MAX_SEC = 0.22


def _hz_to_midi(freq_hz: float) -> int:
    return int(round(69 + 12 * np.log2(freq_hz / 440.0)))


def _midi_to_name(midi_note: int) -> str:
    names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    return f"{names[midi_note % 12]}{(midi_note // 12) - 1}"


def _smooth_f0(f0_hz: np.ndarray) -> np.ndarray:
    out = f0_hz.copy()
    if out.size == 0:
        return out

    # Fill tiny NaN gaps so sustained notes do not split.
    gap_start: Optional[int] = None
    for i, v in enumerate(out):
        if np.isnan(v) and gap_start is None:
            gap_start = i
            continue
        if not np.isnan(v) and gap_start is not None:
            gap_end = i - 1
            gap_len = gap_end - gap_start + 1
            if gap_len <= MAX_INTERPOLATED_GAP_FRAMES and gap_start > 0 and not np.isnan(out[gap_start - 1]):
                left = float(out[gap_start - 1])
                right = float(v)
                for j in range(gap_len):
                    out[gap_start + j] = left + (right - left) * ((j + 1) / (gap_len + 1))
            gap_start = None

    idx = np.where(~np.isnan(out))[0]
    if idx.size < 9:
        return out

    # Extra-strong smoothing: median(9) then avg(7).
    vals = out[idx]
    pad_med = np.pad(vals, (4, 4), mode="edge")
    med = np.array([np.median(pad_med[k : k + 9]) for k in range(vals.size)])
    pad_avg = np.pad(med, (3, 3), mode="edge")
    avg = np.array([np.mean(pad_avg[k : k + 7]) for k in range(med.size)])
    out[idx] = avg
    return out


def _representative_midi(midi_values: List[int], conf_values: List[float]) -> int:
    if not midi_values:
        return 60
    weights: dict[int, float] = {}
    for i, midi in enumerate(midi_values):
        conf = conf_values[i] if i < len(conf_values) else 0.0
        weights[midi] = weights.get(midi, 0.0) + (1.0 + max(0.0, conf))
    best = max(weights.values())
    candidates = [m for m, w in weights.items() if w == best]
    return int(round(float(np.median(candidates))))


def _group_notes(f0_hz: np.ndarray, voiced_prob: np.ndarray, times: np.ndarray) -> List[PitchGroup]:
    groups: List[PitchGroup] = []
    active: Optional[Tuple[int, List[int], List[float], float, int]] = None

    for i, freq in enumerate(f0_hz):
        if np.isnan(freq):
            if active is not None:
                start_idx, midis, confs, conf_sum, count = active
                if count >= MIN_NOTE_FRAMES:
                    midi = _representative_midi(midis, confs)
                    groups.append(
                        PitchGroup(
                            startSec=float(times[start_idx]),
                            endSec=float(times[i - 1]),
                            midi=midi,
                            note=_midi_to_name(midi),
                            confidence=float(conf_sum / count),
                        )
                    )
                active = None
            continue

        midi = _hz_to_midi(float(freq))
        conf = float(voiced_prob[i]) if i < len(voiced_prob) else 0.0
        if active is None:
            active = (i, [midi], [conf], conf, 1)
            continue

        start_idx, midis, confs, conf_sum, count = active
        center = float(np.median(midis))
        if abs(midi - center) <= 0.75:
            midis.append(midi)
            confs.append(conf)
            active = (start_idx, midis, confs, conf_sum + conf, count + 1)
        else:
            if count >= MIN_NOTE_FRAMES:
                chosen = _representative_midi(midis, confs)
                groups.append(
                    PitchGroup(
                        startSec=float(times[start_idx]),
                        endSec=float(times[i - 1]),
                        midi=chosen,
                        note=_midi_to_name(chosen),
                        confidence=float(conf_sum / count),
                    )
                )
            active = (i, [midi], [conf], conf, 1)

    if active is not None:
        start_idx, midis, confs, conf_sum, count = active
        if count >= MIN_NOTE_FRAMES:
            midi = _representative_midi(midis, confs)
            groups.append(
                PitchGroup(
                    startSec=float(times[start_idx]),
                    endSec=float(times[-1]),
                    midi=midi,
                    note=_midi_to_name(midi),
                    confidence=float(conf_sum / count),
                )
            )

    return [g for g in groups if (g.endSec - g.startSec) >= MIN_NOTE_SEC and g.confidence >= 0.1]


def _gap_rms(y: np.ndarray, sr: int, start_sec: float, end_sec: float) -> float:
    a = max(0, int(start_sec * sr))
    b = min(len(y), int(end_sec * sr))
    if b <= a:
        return 0.0
    seg = y[a:b]
    return float(np.sqrt(np.mean(seg * seg))) if seg.size else 0.0


def _fill_non_silent_gaps(groups: List[PitchGroup], y_raw: np.ndarray, sr: int) -> List[PitchGroup]:
    if len(groups) <= 1:
        return groups

    overall = _gap_rms(y_raw, sr, 0.0, len(y_raw) / sr)
    silence_threshold = max(0.004, overall * 0.16)

    out: List[PitchGroup] = [groups[0]]
    for curr in groups[1:]:
        prev = out[-1]
        gap = curr.startSec - prev.endSec
        if gap <= 0 or gap > MAX_GAP_FILL_SEC:
            out.append(curr)
            continue

        gap_energy = _gap_rms(y_raw, sr, prev.endSec, curr.startSec)
        if gap_energy >= silence_threshold and abs(curr.midi - prev.midi) <= NEAR_PITCH_SEMITONES:
            out[-1] = PitchGroup(
                startSec=prev.startSec,
                endSec=curr.startSec,
                midi=prev.midi,
                note=prev.note,
                confidence=prev.confidence,
            )
        out.append(curr)
    return out


def _collapse_semitone_wobble(groups: List[PitchGroup]) -> List[PitchGroup]:
    """
    Collapse adjacent 1-semitone flips (e.g. F# -> F) when they are brief/uncertain.
    Keeps the more stable side so pitch jitter does not create fake accidentals.
    """
    if len(groups) <= 1:
        return groups

    out: List[PitchGroup] = [groups[0]]
    for curr in groups[1:]:
        prev = out[-1]
        semitone = abs(curr.midi - prev.midi)
        prev_dur = prev.endSec - prev.startSec
        curr_dur = curr.endSec - curr.startSec
        if semitone == 1 and (prev_dur <= SEMITONE_WOBBLE_MAX_SEC or curr_dur <= SEMITONE_WOBBLE_MAX_SEC):
            keep = prev if prev.confidence >= curr.confidence else curr
            out[-1] = PitchGroup(
                startSec=prev.startSec,
                endSec=curr.endSec,
                midi=keep.midi,
                note=_midi_to_name(keep.midi),
                confidence=max(prev.confidence, curr.confidence),
            )
        else:
            out.append(curr)
    return out


def _quantize_events(groups: List[PitchGroup], tempo_bpm: int) -> List[Tuple[str, Optional[str], float]]:
    if not groups:
        return [("rest", None, 1.0)]

    beat_sec = 60.0 / max(tempo_bpm, 1)
    step_sec = beat_sec / 4.0
    allowed = [0.25, 0.5, 1.0, 2.0]

    events: List[Tuple[str, Optional[str], float]] = []
    cursor = 0
    for g in sorted(groups, key=lambda x: x.startSec):
        start_step = max(cursor, int(round(g.startSec / step_sec)))
        end_step = max(start_step + 1, int(round(g.endSec / step_sec)))

        if start_step > cursor:
            rest_ql = min(allowed, key=lambda q: abs(q - ((start_step - cursor) / 4.0)))
            if rest_ql >= 0.25:
                events.append(("rest", None, rest_ql))

        note_ql = min(allowed, key=lambda q: abs(q - ((end_step - start_step) / 4.0)))
        events.append(("note", g.note, note_ql))
        cursor = end_step
    return events


def _build_musicxml(title: str, tempo_bpm: int, groups: List[PitchGroup]) -> str:
    score = music21.stream.Score(id="NotidlyScore")
    score.metadata = music21.metadata.Metadata(title=title)

    part = music21.stream.Part(id="P1")
    if groups and float(np.median([g.midi for g in groups])) < 60:
        part.append(music21.clef.BassClef())
    else:
        part.append(music21.clef.TrebleClef())
    part.append(music21.meter.TimeSignature("4/4"))
    part.append(music21.tempo.MetronomeMark(number=tempo_bpm))

    for kind, note_name, ql in _quantize_events(groups, tempo_bpm):
        if kind == "rest":
            n = music21.note.Rest()
        else:
            n = music21.note.Note(note_name or "C4")
        n.duration = music21.duration.Duration(ql)
        part.append(n)

    score.append(part)
    with tempfile.NamedTemporaryFile(suffix=".musicxml", delete=True) as tmp:
        score.write("musicxml", fp=tmp.name)
        tmp.seek(0)
        return tmp.read().decode("utf-8")


def transcribe_from_request(payload: TranscribeRequest) -> TranscribeResponse:
    warnings: List[str] = []
    audio_bytes = fetch_audio_bytes(str(payload.audioUrl))

    y_raw, sr = librosa.load(BytesIO(audio_bytes), sr=22050, mono=True)
    if y_raw.size == 0:
        return TranscribeResponse(xml="", title=payload.title, tempoBpm=90, warnings=["Audio was empty after decode."], pitchGroups=[])

    # Blend raw + harmonic for stable pitch and preserved attacks.
    y_harm = librosa.effects.harmonic(y_raw, margin=2.0)
    y = 0.35 * y_raw + 0.65 * y_harm

    hop = max(1, int(sr * FRAME_HOP_SECONDS))
    f0, voiced_flag, voiced_prob = librosa.pyin(
        y,
        sr=sr,
        fmin=librosa.note_to_hz("C2"),
        fmax=librosa.note_to_hz("C6"),
        frame_length=2048,
        hop_length=hop,
        resolution=0.05,
    )
    times = librosa.times_like(f0, sr=sr, hop_length=hop)

    f0_smoothed = _smooth_f0(f0)
    groups = _group_notes(f0_smoothed, voiced_prob, times)
    groups = _fill_non_silent_gaps(groups, y_raw, sr)
    groups = _collapse_semitone_wobble(groups)

    if len(groups) >= 3:
        median_dur = float(np.median([max(0.05, g.endSec - g.startSec) for g in groups]))
        tempo_bpm = int(np.clip(60.0 / float(np.clip(median_dur, 0.35, 0.8)), 70, 140))
    else:
        tempo_bpm = 90

    if not groups:
        warnings.append("No stable voiced notes were detected.")
    if voiced_flag is not None and np.count_nonzero(voiced_flag) < 8:
        warnings.append("Limited voiced frames detected; results may be sparse.")

    return TranscribeResponse(
        xml=_build_musicxml(payload.title, tempo_bpm, groups),
        title=payload.title,
        tempoBpm=tempo_bpm,
        warnings=warnings,
        pitchGroups=groups,
    )
