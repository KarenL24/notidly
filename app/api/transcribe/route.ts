import { get } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'

// Python backend URL - in production, this would be the deployed FastAPI service
const TRANSCRIPTION_API_URL = process.env.TRANSCRIPTION_API_URL || 'http://localhost:8000'

// Note names for pitch detection
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// Convert frequency to MIDI note number
function frequencyToMidi(freq: number): number {
  return Math.round(12 * Math.log2(freq / 440) + 69)
}

// Convert MIDI note to pitch name and octave
function midiToNote(midi: number): { pitch: string; octave: number } {
  const octave = Math.floor(midi / 12) - 1
  const noteIndex = midi % 12
  const pitch = NOTE_NAMES[noteIndex]
  return { pitch: pitch.replace('#', ''), octave }
}

// Calculate RMS energy of a window
function calculateRMS(samples: Float32Array): number {
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i]
  }
  return Math.sqrt(sum / samples.length)
}

// Normalize audio samples to [-1, 1] range
function normalizeAudio(samples: Float32Array): Float32Array {
  let maxAbs = 0
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i])
    if (abs > maxAbs) maxAbs = abs
  }
  if (maxAbs === 0 || maxAbs >= 0.9) return samples // Already normalized or silent
  
  const normalized = new Float32Array(samples.length)
  const scale = 0.95 / maxAbs
  for (let i = 0; i < samples.length; i++) {
    normalized[i] = samples[i] * scale
  }
  return normalized
}

// Autocorrelation-based pitch detection optimized for vocals
function detectPitch(samples: Float32Array, sampleRate: number): number | null {
  // Skip if window is nearly silent (very low RMS after normalization)
  const rms = calculateRMS(samples)
  if (rms < 0.001) return null // Only skip truly silent frames
  
  const SIZE = samples.length
  // Vocal pitch range: 80Hz (bass) to 800Hz (soprano fundamental)
  const minPeriod = Math.floor(sampleRate / 800)
  const maxPeriod = Math.min(Math.floor(sampleRate / 80), Math.floor(SIZE / 2))
  
  if (maxPeriod <= minPeriod) return null
  
  // Simple autocorrelation - more robust than YIN for noisy audio
  let bestOffset = -1
  let bestCorrelation = 0
  
  // Calculate autocorrelation for each lag
  for (let tau = minPeriod; tau <= maxPeriod; tau++) {
    let correlation = 0
    let norm1 = 0
    let norm2 = 0
    
    for (let i = 0; i < SIZE - tau; i++) {
      correlation += samples[i] * samples[i + tau]
      norm1 += samples[i] * samples[i]
      norm2 += samples[i + tau] * samples[i + tau]
    }
    
    // Normalized correlation coefficient
    const normFactor = Math.sqrt(norm1 * norm2)
    if (normFactor > 0) {
      correlation = correlation / normFactor
    }
    
    // Find peak correlation
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation
      bestOffset = tau
    }
  }
  
  // Accept if correlation is reasonably strong (relaxed for real recordings)
  if (bestOffset > 0 && bestCorrelation > 0.2) {
    // Parabolic interpolation for sub-sample accuracy
    if (bestOffset > minPeriod && bestOffset < maxPeriod) {
      // Calculate correlation at neighboring lags for interpolation
      let corrPrev = 0, corrNext = 0
      let norm1 = 0, norm2p = 0, norm2n = 0
      
      for (let i = 0; i < SIZE - bestOffset - 1; i++) {
        corrPrev += samples[i] * samples[i + bestOffset - 1]
        corrNext += samples[i] * samples[i + bestOffset + 1]
        norm1 += samples[i] * samples[i]
        norm2p += samples[i + bestOffset - 1] * samples[i + bestOffset - 1]
        norm2n += samples[i + bestOffset + 1] * samples[i + bestOffset + 1]
      }
      
      const nfp = Math.sqrt(norm1 * norm2p)
      const nfn = Math.sqrt(norm1 * norm2n)
      if (nfp > 0) corrPrev /= nfp
      if (nfn > 0) corrNext /= nfn
      
      const shift = 0.5 * (corrPrev - corrNext) / (corrPrev - 2 * bestCorrelation + corrNext + 0.0001)
      if (isFinite(shift) && Math.abs(shift) < 1) {
        bestOffset += shift
      }
    }
    
    return sampleRate / bestOffset
  }
  
  return null
}

// Debug info type
interface AnalysisDebug {
  detectedFormat: string
  decodingSucceeded: boolean
  voicedFrames: number
  totalFrames: number
  failureReason: string | null
  sampleRate: number
  bitsPerSample: number
  numChannels: number
  durationSecs: number
  peakAmplitude: number
  rmsLevel: number
  pitchRange: string
}

// Analyze audio buffer and extract notes
async function analyzeAudio(audioBuffer: ArrayBuffer): Promise<{ 
  notes: Array<{ pitch: string; octave: number; type: string }>
  tempo: number
  debug: AnalysisDebug 
}> {
  // Decode audio - we'll use a simple approach for WAV files
  // For a real implementation, you'd use a proper audio decoder
  const dataView = new DataView(audioBuffer)
  
  // Initialize debug info
  const debug: AnalysisDebug = {
    detectedFormat: 'unknown',
    decodingSucceeded: false,
    voicedFrames: 0,
    totalFrames: 0,
    failureReason: null,
    sampleRate: 0,
    bitsPerSample: 0,
    numChannels: 0,
    durationSecs: 0,
    peakAmplitude: 0,
    rmsLevel: 0,
    pitchRange: ''
  }
  
  // Try to parse as WAV
  let samples: Float32Array
  let sampleRate = 44100
  
  try {
    // Check for RIFF header (WAV)
    const header4 = String.fromCharCode(dataView.getUint8(0), dataView.getUint8(1), dataView.getUint8(2), dataView.getUint8(3))
    
    // Check for OggS header (Ogg Vorbis/Opus)
    const isOgg = header4 === 'OggS'
    
    // Check for webm/matroska (starts with 0x1A45DFA3)
    const isWebm = dataView.getUint32(0, false) === 0x1A45DFA3
    
    // Check for ftyp (M4A/MP4)
    const ftyp = String.fromCharCode(dataView.getUint8(4), dataView.getUint8(5), dataView.getUint8(6), dataView.getUint8(7))
    const isM4A = ftyp === 'ftyp'
    
    // Check for ID3 or sync word (MP3)
    const id3 = String.fromCharCode(dataView.getUint8(0), dataView.getUint8(1), dataView.getUint8(2))
    const isMP3 = id3 === 'ID3' || (dataView.getUint8(0) === 0xFF && (dataView.getUint8(1) & 0xE0) === 0xE0)
    
    if (header4 === 'RIFF') {
      debug.detectedFormat = 'wav'
      
      // Parse WAV header - find format and data chunks
      const numChannels = dataView.getUint16(22, true)
      sampleRate = dataView.getUint32(24, true)
      const bitsPerSample = dataView.getUint16(34, true)
      const bytesPerSample = bitsPerSample / 8
      
      debug.sampleRate = sampleRate
      debug.bitsPerSample = bitsPerSample
      debug.numChannels = numChannels
      
      // Find the 'data' chunk (may not be at offset 44)
      let dataOffset = 12 // Start after RIFF header
      let dataSize = 0
      
      while (dataOffset < audioBuffer.byteLength - 8) {
        const chunkId = String.fromCharCode(
          dataView.getUint8(dataOffset),
          dataView.getUint8(dataOffset + 1),
          dataView.getUint8(dataOffset + 2),
          dataView.getUint8(dataOffset + 3)
        )
        const chunkSize = dataView.getUint32(dataOffset + 4, true)
        
        if (chunkId === 'data') {
          dataOffset += 8 // Move past chunk header
          dataSize = chunkSize
          break
        }
        
        // Move to next chunk (size + 8 for header, padded to even byte)
        dataOffset += 8 + chunkSize + (chunkSize % 2)
      }
      
      if (dataSize === 0) {
        debug.failureReason = 'WAV_NO_DATA_CHUNK: Could not find data chunk in WAV file'
        return { notes: [], tempo: 0, debug }
      }
      
      // Calculate samples (mono or convert stereo to mono)
      const totalSamplesPerChannel = Math.floor(dataSize / (numChannels * bytesPerSample))
      const maxSamples = Math.min(totalSamplesPerChannel, sampleRate * 30) // Max 30 seconds
      
      samples = new Float32Array(maxSamples)
      
      for (let i = 0; i < maxSamples; i++) {
        let sampleSum = 0
        for (let ch = 0; ch < numChannels; ch++) {
          const byteOffset = dataOffset + (i * numChannels + ch) * bytesPerSample
          if (byteOffset + bytesPerSample > audioBuffer.byteLength) break
          
          if (bitsPerSample === 16) {
            sampleSum += dataView.getInt16(byteOffset, true) / 32768
          } else if (bitsPerSample === 8) {
            sampleSum += (dataView.getUint8(byteOffset) - 128) / 128
          } else if (bitsPerSample === 24) {
            const b0 = dataView.getUint8(byteOffset)
            const b1 = dataView.getUint8(byteOffset + 1)
            const b2 = dataView.getInt8(byteOffset + 2)
            const val = (b2 << 16) | (b1 << 8) | b0
            sampleSum += val / 8388608
          } else if (bitsPerSample === 32) {
            sampleSum += dataView.getInt32(byteOffset, true) / 2147483648
          }
        }
        samples[i] = sampleSum / numChannels // Average channels
      }
      
      // Calculate duration and amplitude stats
      debug.durationSecs = Math.round(maxSamples / sampleRate * 10) / 10
      
      let peak = 0
      let sumSquares = 0
      for (let i = 0; i < samples.length; i++) {
        const abs = Math.abs(samples[i])
        if (abs > peak) peak = abs
        sumSquares += samples[i] * samples[i]
      }
      debug.peakAmplitude = Math.round(peak * 1000) / 1000
      debug.rmsLevel = Math.round(Math.sqrt(sumSquares / samples.length) * 1000) / 1000
      
      // Normalize audio for better pitch detection
      samples = normalizeAudio(samples)
      
      debug.decodingSucceeded = true
    } else if (isOgg) {
      debug.detectedFormat = 'ogg'
      debug.failureReason = 'OGG_NOT_SUPPORTED: Ogg Vorbis/Opus decoding not available in JS. Please upload WAV format.'
      return { notes: [], tempo: 0, debug }
    } else if (isWebm) {
      debug.detectedFormat = 'webm'
      debug.failureReason = 'WEBM_NOT_SUPPORTED: WebM audio decoding not available in JS. Please upload WAV format.'
      return { notes: [], tempo: 0, debug }
    } else if (isM4A) {
      debug.detectedFormat = 'm4a'
      debug.failureReason = 'M4A_NOT_SUPPORTED: M4A/AAC decoding not available in JS. Please upload WAV format.'
      return { notes: [], tempo: 0, debug }
    } else if (isMP3) {
      debug.detectedFormat = 'mp3'
      debug.failureReason = 'MP3_NOT_SUPPORTED: MP3 decoding not available in JS. Please upload WAV format.'
      return { notes: [], tempo: 0, debug }
    } else {
      debug.detectedFormat = `unknown (header: ${header4})`
      debug.failureReason = 'UNKNOWN_FORMAT: Could not identify audio format. Please upload WAV format.'
      return { notes: [], tempo: 0, debug }
    }
  } catch (err) {
    debug.failureReason = `PARSE_ERROR: ${err instanceof Error ? err.message : 'Unknown parsing error'}`
    return { notes: [], tempo: 0, debug }
  }

  // Analyze samples for pitch using windowed detection
  const windowSize = 2048
  const hopSize = 512 // Smaller hop for better resolution
  const pitches: number[] = []
  let totalWindows = 0
  let minPitch = Infinity
  let maxPitch = 0
  let silentFrames = 0
  let windowRmsSum = 0
  
  for (let i = 0; i < samples.length - windowSize; i += hopSize) {
    totalWindows++
    const window = samples.slice(i, i + windowSize)
    const windowRms = calculateRMS(window)
    windowRmsSum += windowRms
    
    if (windowRms < 0.001) {
      silentFrames++
      continue
    }
    
    const pitch = detectPitch(window, sampleRate)
    // Vocal range: ~80Hz (bass) to ~800Hz (soprano fundamental)
    if (pitch && pitch > 75 && pitch < 900) {
      pitches.push(pitch)
      if (pitch < minPitch) minPitch = pitch
      if (pitch > maxPitch) maxPitch = pitch
    }
  }

  debug.totalFrames = totalWindows
  debug.voicedFrames = pitches.length
  
  const avgWindowRms = totalWindows > 0 ? windowRmsSum / totalWindows : 0
  
  if (pitches.length > 0) {
    const minNote = midiToNote(frequencyToMidi(minPitch))
    const maxNote = midiToNote(frequencyToMidi(maxPitch))
    debug.pitchRange = `${minNote.pitch}${minNote.octave} (${Math.round(minPitch)}Hz) - ${maxNote.pitch}${maxNote.octave} (${Math.round(maxPitch)}Hz)`
  }

  if (pitches.length < 3) {
    // Not enough pitched content detected - return empty for UNUSABLE_AUDIO
    const activeFrames = totalWindows - silentFrames
    debug.failureReason = `INSUFFICIENT_PITCH: ${pitches.length} voiced / ${activeFrames} active / ${totalWindows} total frames. Silent: ${silentFrames}. Avg window RMS: ${avgWindowRms.toFixed(4)}. Peak: ${debug.peakAmplitude}, Overall RMS: ${debug.rmsLevel}`
    return { notes: [], tempo: 0, debug }
  }

  // Group consecutive similar pitches into notes
  const notes: Array<{ pitch: string; octave: number; type: string }> = []
  let currentMidi = -1
  let currentDuration = 0
  
  for (const freq of pitches) {
    const midi = frequencyToMidi(freq)
    if (Math.abs(midi - currentMidi) <= 1) {
      currentDuration++
    } else {
      if (currentMidi > 0 && currentDuration > 0) {
        const { pitch, octave } = midiToNote(currentMidi)
        // Skip sharps/flats for cleaner output
        if (!pitch.includes('#')) {
          const type = currentDuration > 4 ? 'half' : currentDuration > 2 ? 'quarter' : 'eighth'
          notes.push({ pitch, octave, type })
        }
      }
      currentMidi = midi
      currentDuration = 1
    }
  }
  
  // Add final note
  if (currentMidi > 0 && currentDuration > 0) {
    const { pitch, octave } = midiToNote(currentMidi)
    if (!pitch.includes('#')) {
      const type = currentDuration > 4 ? 'half' : currentDuration > 2 ? 'quarter' : 'eighth'
      notes.push({ pitch, octave, type })
    }
  }

  // Estimate tempo based on note density
  const tempo = Math.round(60 * pitches.length / (samples.length / sampleRate) / 4)
  const clampedTempo = Math.max(60, Math.min(160, tempo))

  return { notes: notes.slice(0, 16), tempo: clampedTempo, debug }
}

// Generate MusicXML from notes
function generateMusicXML(title: string, notes: Array<{ pitch: string; octave: number; type: string }>, tempo: number): string {
  const notesPerMeasure = 4
  const measures: string[] = []
  
  for (let i = 0; i < notes.length; i += notesPerMeasure) {
    const measureNotes = notes.slice(i, i + notesPerMeasure)
    const isFirst = i === 0
    
    let measureContent = ''
    
    if (isFirst) {
      measureContent += `
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <direction placement="above">
        <direction-type>
          <metronome><beat-unit>quarter</beat-unit><per-minute>${tempo}</per-minute></metronome>
        </direction-type>
      </direction>`
    }
    
    for (const note of measureNotes) {
      const duration = note.type === 'whole' ? 16 : note.type === 'half' ? 8 : note.type === 'eighth' ? 2 : 4
      measureContent += `
      <note><pitch><step>${note.pitch}</step><octave>${note.octave}</octave></pitch><duration>${duration}</duration><type>${note.type}</type></note>`
    }
    
    measures.push(`
    <measure number="${Math.floor(i / notesPerMeasure) + 1}">${measureContent}
    </measure>`)
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work>
    <work-title>${title}</work-title>
  </work>
  <part-list>
    <score-part id="P1">
      <part-name>Melody</part-name>
    </score-part>
  </part-list>
  <part id="P1">${measures.join('')}
  </part>
</score-partwise>`
}

export async function POST(request: NextRequest) {
  try {
    const { pathname, title, blobUrl } = await request.json()

    if (!pathname) {
      return NextResponse.json({ 
        success: false, 
        errorCode: 'MISSING_PATHNAME',
        error: 'No audio pathname provided' 
      }, { status: 400 })
    }

    // Get the audio file from blob storage
    const result = await get(pathname, { access: 'private' })
    
    if (!result) {
      return NextResponse.json({ 
        success: false,
        errorCode: 'FILE_NOT_FOUND', 
        error: 'Audio file not found' 
      }, { status: 404 })
    }

    // Build the audio URL for the Python backend to download.
    // Prefer direct Blob URL when available so FastAPI can fetch it directly.
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    const audioUrl = result.downloadUrl || blobUrl || `${baseUrl}/api/audio?pathname=${encodeURIComponent(pathname)}`

    // Try calling the Python transcription backend first
    try {
      const transcribeResponse = await fetch(`${TRANSCRIPTION_API_URL}/api/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioUrl: audioUrl,
          title: title || 'Untitled'
        }),
      })

      const data = await transcribeResponse.json()

      if (data.ok === false) {
        return NextResponse.json({
          success: false,
          errorCode: data.errorCode,
          error: data.message
        }, { status: 422 })
      }

      // Success from Python backend - the ONLY valid success path
      return NextResponse.json({
        success: true,
        musicxml: data.xml,
        title: data.title,
        tempoBpm: data.tempoBpm,
        warnings: data.warnings || [],
        pathname: pathname,
        source: 'PYTHON_BACKEND', // Explicit source label
        isPythonBackend: true
      })

    } catch (pythonError) {
      // Python backend not available - route to failure state
      // JS analysis is kept for DEBUG ONLY, not as a success path
      
      // Optionally collect debug info from JS analysis (for diagnostics only)
      let jsDebug = null
      try {
        const audioResponse = await fetch(`${baseUrl}/api/audio?pathname=${encodeURIComponent(pathname)}`)
        if (audioResponse.ok) {
          const audioBuffer = await audioResponse.arrayBuffer()
          const { debug } = await analyzeAudio(audioBuffer)
          jsDebug = {
            detectedFormat: debug.detectedFormat,
            decodingSucceeded: debug.decodingSucceeded,
            voicedFrames: debug.voicedFrames,
            totalFrames: debug.totalFrames,
            failureReason: debug.failureReason,
            sampleRate: debug.sampleRate,
            bitsPerSample: debug.bitsPerSample,
            numChannels: debug.numChannels,
            durationSecs: debug.durationSecs,
            peakAmplitude: debug.peakAmplitude,
            rmsLevel: debug.rmsLevel,
            pitchRange: debug.pitchRange
          }
        }
      } catch {
        // Ignore JS analysis errors - it's just for debug
      }
      
      return NextResponse.json({
        success: false,
        errorCode: 'PYTHON_BACKEND_UNAVAILABLE',
        error: `The Python transcription backend is not available. Set TRANSCRIPTION_API_URL environment variable to a running FastAPI instance. Current target: ${TRANSCRIPTION_API_URL}`,
        pythonBackendUrl: TRANSCRIPTION_API_URL,
        debugSource: 'FAILURE_STATE',
        jsDebug: jsDebug // Debug info only - not used for rendering
      }, { status: 503 })
    }

  } catch (error) {
    console.error('Transcription error:', error)
    return NextResponse.json({ 
      success: false,
      errorCode: 'INTERNAL_ERROR',
      error: 'Transcription failed' 
    }, { status: 500 })
  }
}
