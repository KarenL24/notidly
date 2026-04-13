"""
Notidly MVP Transcription API
FastAPI backend for monophonic melody extraction and MusicXML generation.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import numpy as np
import requests
import io
import tempfile
import os

# Audio processing
import librosa
import soundfile as sf

# Music notation
from music21 import stream, note, meter, key, clef, metadata

app = FastAPI(title="Notidly Transcription API")


class TranscribeRequest(BaseModel):
    audioUrl: str
    title: str


class TranscribeSuccessResponse(BaseModel):
    ok: bool = True
    title: str
    tempoBpm: int
    xml: str
    warnings: List[str]


class TranscribeErrorResponse(BaseModel):
    ok: bool = False
    errorCode: str
    message: str


def download_audio(url: str) -> bytes:
    """Download audio file from URL."""
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    return response.content


def load_audio(audio_bytes: bytes) -> tuple[np.ndarray, int]:
    """Load audio bytes into numpy array using librosa."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    
    try:
        # Load audio with librosa, mono and resampled to 22050Hz
        y, sr = librosa.load(tmp_path, sr=22050, mono=True, duration=30.0)
        return y, sr
    finally:
        os.unlink(tmp_path)


def extract_melody(y: np.ndarray, sr: int) -> tuple[np.ndarray, np.ndarray, float]:
    """
    Extract monophonic melody using pYIN pitch detection.
    Returns: (times, pitches_hz, estimated_tempo)
    """
    # Use pYIN for monophonic pitch tracking (good for vocals)
    f0, voiced_flag, voiced_probs = librosa.pyin(
        y,
        fmin=librosa.note_to_hz('C2'),
        fmax=librosa.note_to_hz('C7'),
        sr=sr,
        frame_length=2048,
        hop_length=512
    )
    
    # Get time stamps
    times = librosa.times_like(f0, sr=sr, hop_length=512)
    
    # Estimate tempo
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    estimated_tempo = float(tempo) if not isinstance(tempo, np.ndarray) else float(tempo[0])
    
    # Clamp tempo to reasonable range
    if estimated_tempo < 40:
        estimated_tempo = 72.0
    elif estimated_tempo > 200:
        estimated_tempo = 120.0
    
    return times, f0, estimated_tempo


def hz_to_midi(hz: float) -> int:
    """Convert frequency in Hz to MIDI note number."""
    if hz <= 0 or np.isnan(hz):
        return 0
    return int(round(12 * np.log2(hz / 440.0) + 69))


def midi_to_note_name(midi: int) -> tuple[str, int]:
    """Convert MIDI note to (step, octave)."""
    note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    octave = (midi // 12) - 1
    step = note_names[midi % 12]
    return step, octave


def quantize_duration(duration_seconds: float, tempo: float) -> tuple[float, str]:
    """
    Quantize duration to nearest standard note value.
    Returns (duration_in_quarter_notes, note_type_string)
    """
    # Convert seconds to quarter notes
    seconds_per_beat = 60.0 / tempo
    duration_quarters = duration_seconds / seconds_per_beat
    
    # Standard durations in quarter notes
    durations = [
        (4.0, "whole"),
        (3.0, "dotted-half"),
        (2.0, "half"),
        (1.5, "dotted-quarter"),
        (1.0, "quarter"),
        (0.75, "dotted-eighth"),
        (0.5, "eighth"),
        (0.25, "16th"),
    ]
    
    # Find closest
    best_duration = 1.0
    best_type = "quarter"
    min_diff = float('inf')
    
    for dur, typ in durations:
        diff = abs(duration_quarters - dur)
        if diff < min_diff:
            min_diff = diff
            best_duration = dur
            best_type = typ
    
    return best_duration, best_type


def pitches_to_notes(times: np.ndarray, f0: np.ndarray, tempo: float) -> List[dict]:
    """
    Convert pitch contour to discrete note events.
    Groups consecutive frames with same pitch into notes.
    """
    notes = []
    current_midi = 0
    current_start = 0.0
    
    for i, (t, hz) in enumerate(zip(times, f0)):
        midi = hz_to_midi(hz) if not np.isnan(hz) else 0
        
        if midi != current_midi:
            # End previous note
            if current_midi > 0:
                duration = t - current_start
                if duration > 0.05:  # Minimum note duration
                    dur_quarters, dur_type = quantize_duration(duration, tempo)
                    step, octave = midi_to_note_name(current_midi)
                    notes.append({
                        "step": step.replace('#', ''),
                        "alter": 1 if '#' in step else 0,
                        "octave": octave,
                        "duration": dur_quarters,
                        "type": dur_type
                    })
            
            # Start new note
            current_midi = midi
            current_start = t
    
    # Handle last note
    if current_midi > 0 and len(times) > 0:
        duration = times[-1] - current_start
        if duration > 0.05:
            dur_quarters, dur_type = quantize_duration(duration, tempo)
            step, octave = midi_to_note_name(current_midi)
            notes.append({
                "step": step.replace('#', ''),
                "alter": 1 if '#' in step else 0,
                "octave": octave,
                "duration": dur_quarters,
                "type": dur_type
            })
    
    return notes


def notes_to_musicxml(notes: List[dict], title: str, tempo: int) -> str:
    """
    Convert note events to MusicXML using music21.
    """
    # Create a music21 stream
    s = stream.Score()
    s.metadata = metadata.Metadata()
    s.metadata.title = title
    
    # Create a part for the melody
    p = stream.Part()
    p.id = 'melody'
    
    # Add clef and time signature
    m = stream.Measure(number=1)
    m.append(clef.TrebleClef())
    m.append(meter.TimeSignature('4/4'))
    m.append(key.Key('C'))
    
    # Track position in measure
    current_beat = 0.0
    measure_num = 1
    
    for n in notes:
        # Create note
        pitch_name = n["step"]
        if n["alter"] == 1:
            pitch_name += "#"
        pitch_name += str(n["octave"])
        
        new_note = note.Note(pitch_name)
        new_note.quarterLength = n["duration"]
        
        # Check if note fits in current measure
        if current_beat + n["duration"] > 4.0:
            # Start new measure
            p.append(m)
            measure_num += 1
            m = stream.Measure(number=measure_num)
            current_beat = 0.0
        
        m.append(new_note)
        current_beat += n["duration"]
    
    # Append final measure
    if len(m.notes) > 0:
        p.append(m)
    
    s.append(p)
    
    # Convert to MusicXML string
    return s.write('musicxml').read_text()


def generate_simple_musicxml(notes: List[dict], title: str, tempo: int) -> str:
    """
    Generate MusicXML string directly (fallback if music21 has issues).
    """
    divisions = 4  # divisions per quarter note
    
    xml_parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
        '<score-partwise version="3.1">',
        '  <work>',
        f'    <work-title>{title}</work-title>',
        '  </work>',
        '  <part-list>',
        '    <score-part id="P1">',
        '      <part-name>Melody</part-name>',
        '    </score-part>',
        '  </part-list>',
        '  <part id="P1">',
    ]
    
    # Group notes into measures
    current_beat = 0.0
    measure_num = 1
    measure_notes = []
    measures = []
    
    for n in notes:
        if current_beat + n["duration"] > 4.0:
            measures.append(measure_notes)
            measure_notes = []
            current_beat = 0.0
            measure_num += 1
        
        measure_notes.append(n)
        current_beat += n["duration"]
    
    if measure_notes:
        measures.append(measure_notes)
    
    # Generate XML for each measure
    for i, m_notes in enumerate(measures):
        xml_parts.append(f'    <measure number="{i + 1}">')
        
        if i == 0:
            xml_parts.extend([
                '      <attributes>',
                f'        <divisions>{divisions}</divisions>',
                '        <key><fifths>0</fifths></key>',
                '        <time><beats>4</beats><beat-type>4</beat-type></time>',
                '        <clef><sign>G</sign><line>2</line></clef>',
                '      </attributes>',
                '      <direction placement="above">',
                '        <direction-type>',
                f'          <metronome><beat-unit>quarter</beat-unit><per-minute>{tempo}</per-minute></metronome>',
                '        </direction-type>',
                '      </direction>',
            ])
        
        for n in m_notes:
            duration = int(n["duration"] * divisions)
            xml_parts.append('      <note>')
            xml_parts.append('        <pitch>')
            xml_parts.append(f'          <step>{n["step"]}</step>')
            if n["alter"] != 0:
                xml_parts.append(f'          <alter>{n["alter"]}</alter>')
            xml_parts.append(f'          <octave>{n["octave"]}</octave>')
            xml_parts.append('        </pitch>')
            xml_parts.append(f'        <duration>{duration}</duration>')
            xml_parts.append(f'        <type>{n["type"]}</type>')
            xml_parts.append('      </note>')
        
        xml_parts.append('    </measure>')
    
    xml_parts.extend([
        '  </part>',
        '</score-partwise>'
    ])
    
    return '\n'.join(xml_parts)


@app.post("/api/transcribe")
async def transcribe(request: TranscribeRequest):
    """
    Transcribe audio to MusicXML melody notation.
    """
    try:
        # Download audio
        try:
            audio_bytes = download_audio(request.audioUrl)
        except Exception as e:
            return TranscribeErrorResponse(
                errorCode="DOWNLOAD_FAILED",
                message="Could not download the audio file."
            )
        
        # Load audio
        try:
            y, sr = load_audio(audio_bytes)
        except Exception as e:
            return TranscribeErrorResponse(
                errorCode="INVALID_AUDIO",
                message="Could not read the audio file. Please try a different format."
            )
        
        # Check audio length
        duration = len(y) / sr
        if duration < 1.0:
            return TranscribeErrorResponse(
                errorCode="AUDIO_TOO_SHORT",
                message="Audio is too short. Please upload at least 1 second of audio."
            )
        
        # Extract melody
        try:
            times, f0, tempo = extract_melody(y, sr)
        except Exception as e:
            return TranscribeErrorResponse(
                errorCode="EXTRACTION_FAILED",
                message="Could not extract melody from this clip."
            )
        
        # Check if we detected enough pitched content
        valid_pitches = np.sum(~np.isnan(f0))
        if valid_pitches < len(f0) * 0.1:  # Less than 10% pitched content
            return TranscribeErrorResponse(
                errorCode="UNUSABLE_AUDIO",
                message="We couldn't generate a reliable melody from this clip."
            )
        
        # Convert pitches to notes
        notes = pitches_to_notes(times, f0, tempo)
        
        if len(notes) < 2:
            return TranscribeErrorResponse(
                errorCode="UNUSABLE_AUDIO",
                message="We couldn't generate a reliable melody from this clip."
            )
        
        # Generate MusicXML
        tempo_int = int(round(tempo))
        try:
            xml = generate_simple_musicxml(notes, request.title, tempo_int)
        except Exception as e:
            return TranscribeErrorResponse(
                errorCode="XML_GENERATION_FAILED",
                message="Could not generate notation. Please try again."
            )
        
        return TranscribeSuccessResponse(
            title=request.title,
            tempoBpm=tempo_int,
            xml=xml,
            warnings=["Draft only. Review recommended."]
        )
        
    except Exception as e:
        return TranscribeErrorResponse(
            errorCode="INTERNAL_ERROR",
            message="An unexpected error occurred. Please try again."
        )


@app.get("/health")
async def health():
    return {"status": "ok"}
