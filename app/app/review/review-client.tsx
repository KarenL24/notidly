"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { FileDown, HelpCircle, Play, Pause, RotateCcw, CheckCircle2, ChevronDown, ChevronUp, Music2, Square, SkipBack, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { MelodyDisplay } from "@/components/melody-display"
const REVIEW_RESULT_STORAGE_KEY = "notidly:last-transcription-result"

export type ReviewClientProps = {
  pieceTitle: string
  fileName: string
  pathname: string
  resultId: string | null
  musicxml: string | null
  tempoBpm: string
  source: string
  isPythonBackend: boolean
  warnings: string[]
  pitchGroups: Array<{
    startSec: number
    endSec: number
    midi: number
    note: string
    confidence: number
  }>
}

export default function ReviewClient({
  pieceTitle,
  fileName,
  pathname,
  resultId,
  musicxml,
  tempoBpm,
  source,
  isPythonBackend,
  warnings,
  pitchGroups,
}: ReviewClientProps) {
  const router = useRouter()
  const [resolvedMusicxml, setResolvedMusicxml] = useState<string | null>(musicxml)
  const [resolvedTempoBpm, setResolvedTempoBpm] = useState<string>(tempoBpm)
  const [resolvedSource, setResolvedSource] = useState<string>(source)
  const [resolvedIsPythonBackend, setResolvedIsPythonBackend] = useState<boolean>(isPythonBackend)
  const [resolvedWarnings, setResolvedWarnings] = useState<string[]>(warnings)
  const [resolvedPitchGroups, setResolvedPitchGroups] = useState(pitchGroups)
  
  // Parse notes from MusicXML for debug display
  const parseNotesFromMusicXML = (xml: string | null): string[] => {
    if (!xml) return []
    const notes: string[] = []
    const noteMatches = xml.matchAll(/<note>[\s\S]*?<step>(\w)<\/step>[\s\S]*?<octave>(\d)<\/octave>[\s\S]*?<\/note>/g)
    for (const match of noteMatches) {
      notes.push(`${match[1]}${match[2]}`)
    }
    return notes
  }
  
  useEffect(() => {
    if (musicxml || resultId) return
    if (typeof window === "undefined") return

    const raw = sessionStorage.getItem(REVIEW_RESULT_STORAGE_KEY)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      setResolvedMusicxml((parsed.musicxml as string) || null)
      setResolvedTempoBpm(String(parsed.tempoBpm || "0"))
      setResolvedSource(String(parsed.source || "UNKNOWN"))
      setResolvedIsPythonBackend(Boolean(parsed.isPythonBackend))
      setResolvedWarnings(Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [])
      setResolvedPitchGroups(Array.isArray(parsed.pitchGroups) ? (parsed.pitchGroups as typeof pitchGroups) : [])
    } catch (error) {
      console.error("Failed to restore transcription result from sessionStorage", error)
    }
  }, [musicxml, pitchGroups, resultId])

  useEffect(() => {
    if (!resultId) return
    let cancelled = false

    const fetchResult = async () => {
      try {
        const response = await fetch(`/api/transcription-result/${encodeURIComponent(resultId)}`)
        if (!response.ok) return
        const data = await response.json()
        if (!data?.success || !data?.result || cancelled) return

        const parsed = data.result as Record<string, unknown>
        setResolvedMusicxml((parsed.musicxml as string) || null)
        setResolvedTempoBpm(String(parsed.tempoBpm || "0"))
        setResolvedSource(String(parsed.source || "UNKNOWN"))
        setResolvedIsPythonBackend(Boolean(parsed.isPythonBackend))
        setResolvedWarnings(Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [])
        setResolvedPitchGroups(
          Array.isArray(parsed.pitchGroups) ? (parsed.pitchGroups as typeof pitchGroups) : []
        )
      } catch (error) {
        console.error("Failed to fetch transcription result by id", error)
      }
    }

    fetchResult()
    return () => {
      cancelled = true
    }
  }, [resultId, pitchGroups])

  const detectedNotes = parseNotesFromMusicXML(resolvedMusicxml)
  const showDebugPanel = true // TEMPORARY: Set to false to hide debug panel
  
  // Determine the actual render source - now only PYTHON_BACKEND is valid
  const getScoreSource = () => {
    if (!resolvedMusicxml) return "no-xml" // No XML at all
    if (detectedNotes.length === 0) return "parse-failed" // XML didn't parse
    if (resolvedIsPythonBackend) return "python-backend" // Python backend - the only valid source
    return "unknown" // Should not happen with new logic
  }
  const scoreSource = getScoreSource()
  
  // Get source label and color
  const getSourceLabel = () => {
    switch (scoreSource) {
      case "python-backend": return { label: "PYTHON BACKEND", color: "bg-green-100 text-green-800" }
      case "parse-failed": return { label: "PARSE FAILED", color: "bg-red-100 text-red-800" }
      case "no-xml": return { label: "NO XML RECEIVED", color: "bg-red-100 text-red-800" }
      default: return { label: "UNKNOWN", color: "bg-gray-100 text-gray-800" }
    }
  }
  const sourceInfo = getSourceLabel()
  
  // Audio element ref
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const synthContextRef = useRef<AudioContext | null>(null)
  const synthOscillatorsRef = useRef<OscillatorNode[]>([])
  const synthTimeoutRef = useRef<number | null>(null)
  const overlayPlayingRef = useRef(false)
  const overlayAudioVolumeRef = useRef<number>(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isSynthPlaying, setIsSynthPlaying] = useState(false)
  const [isOverlayPlaying, setIsOverlayPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)
  const [audioReady, setAudioReady] = useState(false)
  const [audioLoadError, setAudioLoadError] = useState<string | null>(null)
  
  // Audio source URL
  const audioSrc = pathname ? `/api/audio?pathname=${encodeURIComponent(pathname)}` : ""
  
  // Help modal state
  const [helpModalOpen, setHelpModalOpen] = useState(false)
  const [helpEmail, setHelpEmail] = useState("")
  const [helpMessage, setHelpMessage] = useState("")
  const [helpSubmitted, setHelpSubmitted] = useState(false)
  const [debugCollapsed, setDebugCollapsed] = useState(false)

  useEffect(() => {
    overlayPlayingRef.current = isOverlayPlaying
  }, [isOverlayPlaying])
  
  const canSubmitHelp = helpEmail.trim() !== "" && helpMessage.trim() !== ""
  
  const handleHelpSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (canSubmitHelp) {
      setHelpSubmitted(true)
    }
  }
  
  const handleCloseHelpModal = () => {
    setHelpModalOpen(false)
    // Reset state after modal closes
    setTimeout(() => {
      setHelpEmail("")
      setHelpMessage("")
      setHelpSubmitted(false)
    }, 200)
  }

  // Initialize audio element
  useEffect(() => {
    if (!audioSrc) return
    
    const audio = new Audio(audioSrc)
    audio.preload = "auto"
    audioRef.current = audio

    setIsPlaying(false)
    setCurrentTime(0)
    setTotalDuration(0)
    setAudioReady(false)
    setAudioLoadError(null)

    const onLoadedMetadata = () => {
      setTotalDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
      setAudioReady(true)
      setAudioLoadError(null)
    }

    const onCanPlay = () => {
      setAudioReady(true)
      setAudioLoadError(null)
      if (Number.isFinite(audio.duration)) {
        setTotalDuration(audio.duration)
      }
    }

    const onTimeUpdate = () => {
      setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0)
    }

    const onEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
      if (overlayPlayingRef.current) {
        stopSynthPlayback()
        audio.volume = overlayAudioVolumeRef.current
        setIsOverlayPlaying(false)
      }
    }

    let didRetry = false
    const onError = () => {
      const mediaError = audio.error
      const errorDetails = mediaError
        ? `code=${mediaError.code}${mediaError.message ? ` message=${mediaError.message}` : ""}`
        : "unknown media error"
      console.error("Audio error:", errorDetails, { src: audio.src })
      setAudioReady(false)
      setAudioLoadError("Audio failed to load. Please try again.")
      if (overlayPlayingRef.current) {
        stopSynthPlayback()
        audio.volume = overlayAudioVolumeRef.current
        setIsOverlayPlaying(false)
      }
      if (!didRetry) {
        didRetry = true
        audio.src = `${audioSrc}${audioSrc.includes("?") ? "&" : "?"}retry=${Date.now()}`
        audio.load()
      }
    }

    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    audio.load()
    
    return () => {
      audio.pause()
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.src = ''
    }
  }, [audioSrc])
  
  // Handle play/pause
  useEffect(() => {
    if (!audioRef.current) return
    
    if (isPlaying) {
      audioRef.current.play().catch(console.error)
    } else {
      audioRef.current.pause()
    }
  }, [isPlaying])

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const noteNameToMidi = (note: string): number | null => {
    const m = note.trim().match(/^([A-Ga-g])([#b-]?)(-?\d+)$/)
    if (!m) return null
    const step = m[1].toUpperCase()
    const accidental = m[2]
    const octave = Number(m[3])
    if (!Number.isFinite(octave)) return null
    const stepOffsets: Record<string, number> = {
      C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
    }
    let semitone = stepOffsets[step]
    if (accidental === "#" ) semitone += 1
    if (accidental === "b" || accidental === "-") semitone -= 1
    return (octave + 1) * 12 + semitone
  }

  const midiToFrequency = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

  const stopSynthPlayback = () => {
    synthOscillatorsRef.current.forEach((osc) => {
      try { osc.stop() } catch {}
    })
    synthOscillatorsRef.current = []
    if (synthTimeoutRef.current !== null) {
      window.clearTimeout(synthTimeoutRef.current)
      synthTimeoutRef.current = null
    }
    if (synthContextRef.current) {
      synthContextRef.current.close().catch(() => {})
      synthContextRef.current = null
    }
    setIsSynthPlaying(false)
  }

  const playSynthPreview = async () => {
    stopSynthPlayback()

    const fromGroups = resolvedPitchGroups
      .map((g) => ({
        midi: Number.isFinite(g.midi) ? g.midi : noteNameToMidi(g.note),
        start: Math.max(0, g.startSec),
        duration: Math.max(0.1, g.endSec - g.startSec),
      }))
      .filter((n): n is { midi: number; duration: number; start: number } => Number.isFinite(n.midi))

    const fallback = detectedNotes
      .map((n, idx) => ({ midi: noteNameToMidi(n), start: idx * 0.35, duration: 0.35 }))
      .filter((n): n is { midi: number; duration: number; start: number } => Number.isFinite(n.midi))

    const notes = fromGroups.length > 0 ? fromGroups : fallback
    if (notes.length === 0) return

    const context = new window.AudioContext()
    await context.resume()
    synthContextRef.current = context
    const startAt = context.currentTime + 0.05
    let endCursor = startAt

    notes.slice(0, 64).forEach((note) => {
      const freq = midiToFrequency(note.midi)
      const dur = Math.min(Math.max(note.duration, 0.12), 1.8)
      const cursor = startAt + note.start
      const noteOut = context.createGain()
      noteOut.gain.value = 0.9

      const lowpass = context.createBiquadFilter()
      lowpass.type = "lowpass"
      lowpass.frequency.setValueAtTime(4200, cursor)
      lowpass.Q.value = 0.7

      const env = context.createGain()
      env.gain.setValueAtTime(0.0001, cursor)
      env.gain.exponentialRampToValueAtTime(0.22, cursor + 0.008)
      env.gain.exponentialRampToValueAtTime(0.09, cursor + 0.09)
      env.gain.exponentialRampToValueAtTime(0.0001, cursor + dur + 0.06)

      lowpass.connect(env)
      env.connect(noteOut)
      noteOut.connect(context.destination)

      const partials = [
        { mul: 1, gain: 1.0, type: "triangle" as OscillatorType, detune: 0 },
        { mul: 2, gain: 0.34, type: "sine" as OscillatorType, detune: 2.5 },
        { mul: 3, gain: 0.18, type: "sine" as OscillatorType, detune: -1.8 },
      ]

      partials.forEach((p) => {
        const osc = context.createOscillator()
        const oscGain = context.createGain()
        osc.type = p.type
        osc.frequency.setValueAtTime(freq * p.mul, cursor)
        osc.detune.setValueAtTime(p.detune, cursor)
        oscGain.gain.setValueAtTime(p.gain, cursor)
        osc.connect(oscGain)
        oscGain.connect(lowpass)
        osc.start(cursor)
        osc.stop(cursor + dur + 0.08)
        synthOscillatorsRef.current.push(osc)
      })

      endCursor = Math.max(endCursor, cursor + dur)
    })

    setIsSynthPlaying(true)
    const ms = Math.max(100, Math.ceil((endCursor - startAt) * 1000))
    synthTimeoutRef.current = window.setTimeout(() => {
      stopSynthPlayback()
    }, ms)
  }

  const playOverlayCompare = async () => {
    if (!audioRef.current || !audioReady) return
    stopSynthPlayback()
    overlayAudioVolumeRef.current = audioRef.current.volume || 1
    audioRef.current.volume = 0.45
    audioRef.current.currentTime = 0
    setCurrentTime(0)
    setIsPlaying(false)
    setIsOverlayPlaying(true)

    try {
      await audioRef.current.play()
    } catch (error) {
      console.error("Failed to start audio for overlay mode", error)
      setIsOverlayPlaying(false)
      return
    }

    const fromGroups = resolvedPitchGroups
      .map((g) => ({
        midi: Number.isFinite(g.midi) ? g.midi : noteNameToMidi(g.note),
        start: Math.max(0, g.startSec),
        duration: Math.max(0.1, g.endSec - g.startSec),
      }))
      .filter((n): n is { midi: number; duration: number; start: number } => Number.isFinite(n.midi))
      .slice(0, 96)

    if (fromGroups.length === 0) {
      setIsOverlayPlaying(false)
      return
    }

    const context = new window.AudioContext()
    await context.resume()
    synthContextRef.current = context
    const startAt = context.currentTime + 0.05
    let endCursor = startAt

    fromGroups.forEach((note) => {
      const freq = midiToFrequency(note.midi)
      const dur = Math.min(Math.max(note.duration, 0.12), 2.2)
      const cursor = startAt + note.start

      const noteOut = context.createGain()
      noteOut.gain.value = 0.95
      const lowpass = context.createBiquadFilter()
      lowpass.type = "lowpass"
      lowpass.frequency.setValueAtTime(3900, cursor)
      lowpass.Q.value = 0.7
      const env = context.createGain()
      env.gain.setValueAtTime(0.0001, cursor)
      env.gain.exponentialRampToValueAtTime(0.24, cursor + 0.008)
      env.gain.exponentialRampToValueAtTime(0.11, cursor + 0.08)
      env.gain.exponentialRampToValueAtTime(0.0001, cursor + dur + 0.06)
      lowpass.connect(env)
      env.connect(noteOut)
      noteOut.connect(context.destination)

      ;[
        { mul: 1, gain: 1.0, type: "triangle" as OscillatorType, detune: 0 },
        { mul: 2, gain: 0.34, type: "sine" as OscillatorType, detune: 1.8 },
        { mul: 3, gain: 0.16, type: "sine" as OscillatorType, detune: -1.4 },
      ].forEach((p) => {
        const osc = context.createOscillator()
        const oscGain = context.createGain()
        osc.type = p.type
        osc.frequency.setValueAtTime(freq * p.mul, cursor)
        osc.detune.setValueAtTime(p.detune, cursor)
        oscGain.gain.setValueAtTime(p.gain, cursor)
        osc.connect(oscGain)
        oscGain.connect(lowpass)
        osc.start(cursor)
        osc.stop(cursor + dur + 0.08)
        synthOscillatorsRef.current.push(osc)
      })

      endCursor = Math.max(endCursor, cursor + dur)
    })

    setIsSynthPlaying(true)
    synthTimeoutRef.current = window.setTimeout(() => {
      stopSynthPlayback()
      setIsOverlayPlaying(false)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        audioRef.current.volume = overlayAudioVolumeRef.current
      }
      setIsPlaying(false)
      setCurrentTime(0)
    }, Math.max(100, Math.ceil((endCursor - startAt) * 1000)))
  }

  const stopOverlayCompare = () => {
    stopSynthPlayback()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current.volume = overlayAudioVolumeRef.current
    }
    setIsPlaying(false)
    setCurrentTime(0)
    setIsOverlayPlaying(false)
  }

  const restartOverlayCompare = () => {
    stopOverlayCompare()
    void playOverlayCompare()
  }

  useEffect(() => {
    return () => {
      stopSynthPlayback()
    }
  }, [])

  const restartSynthPlayback = () => {
    stopSynthPlayback()
    void playSynthPreview()
  }

  const handleExportPdf = () => {
    // Generate a simple placeholder PDF using canvas
    const canvas = document.createElement("canvas")
    canvas.width = 612 // US Letter width in points at 72dpi
    canvas.height = 792 // US Letter height in points at 72dpi
    const ctx = canvas.getContext("2d")
    
    if (ctx) {
      // White background
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // Header with logo text
      ctx.fillStyle = "#F97316"
      ctx.font = "bold 24px system-ui, sans-serif"
      ctx.fillText("Notidly", 50, 60)
      
      // Draft badge
      ctx.fillStyle = "#f3f4f6"
      ctx.fillRect(140, 42, 50, 24)
      ctx.fillStyle = "#6b7280"
      ctx.font = "12px system-ui, sans-serif"
      ctx.fillText("Draft", 150, 58)
      
      // Piece title
      ctx.fillStyle = "#111827"
      ctx.font = "bold 28px system-ui, sans-serif"
      ctx.fillText(pieceTitle, 50, 120)
      
      // Subtitle
      ctx.fillStyle = "#6b7280"
      ctx.font = "14px system-ui, sans-serif"
      ctx.fillText("Melody draft generated from audio", 50, 150)
      
      // Staff lines placeholder
      ctx.strokeStyle = "#d1d5db"
      ctx.lineWidth = 1
      for (let staff = 0; staff < 4; staff++) {
        const yBase = 220 + staff * 120
        for (let line = 0; line < 5; line++) {
          ctx.beginPath()
          ctx.moveTo(50, yBase + line * 10)
          ctx.lineTo(562, yBase + line * 10)
          ctx.stroke()
        }
      }
      
      // Placeholder note symbols
      ctx.fillStyle = "#374151"
      ctx.font = "32px serif"
      ctx.fillText("\u{1D11E}", 55, 250) // Treble clef unicode
      
      // Footer
      ctx.fillStyle = "#9ca3af"
      ctx.font = "11px system-ui, sans-serif"
      ctx.fillText("Generated by Notidly - This is a draft for review", 50, 750)
      ctx.fillText(`Source: ${fileName}`, 50, 768)
    }
    
    // Convert canvas to blob and trigger download
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        // Sanitize title for filename
        const safeTitle = pieceTitle.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-")
        link.download = `${safeTitle}-draft.pdf`
        link.href = url
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        
        // Navigate to success page after download starts
        const params = new URLSearchParams({ title: pieceTitle, file: fileName })
        router.push(`/app/review/success?${params.toString()}`)
      }
    }, "image/png") // Note: This creates a PNG disguised as PDF for MVP demo purposes
  }

  return (
    <div className="min-h-screen bg-background flex flex-col animate-in fade-in duration-300">
      {/* Header */}
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
        <Image
          src="/notidly-logo.svg"
          alt="Notidly"
          width={143}
          height={57}
          className="h-9 w-auto"
          priority
        />
        <Button 
          onClick={handleExportPdf}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-5"
        >
          <FileDown className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-3xl space-y-8">
          {/* Title and Draft badge */}
          <div className="flex items-center justify-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground text-balance text-center">
              {pieceTitle}
            </h1>
            <Badge variant="secondary" className="text-xs font-medium">
              Draft
            </Badge>
          </div>

          {/* Helper text */}
          <p className="text-center text-muted-foreground text-sm">
            This is a draft melody sheet generated from your audio.
          </p>

          {/* Melody notation */}
          <MelodyDisplay musicxml={resolvedMusicxml} />

          {/* Audio player */}
          <div className="bg-secondary/50 rounded-xl px-5 py-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = 0
                      setCurrentTime(0)
                      setIsPlaying(false)
                    }
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90"
                  onClick={() => setIsPlaying(!isPlaying)}
                  disabled={!audioReady}
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5 fill-primary-foreground text-primary-foreground" />
                  ) : (
                    <Play className="h-5 w-5 fill-primary-foreground text-primary-foreground ml-0.5" />
                  )}
                </Button>
              </div>

              <div className="flex-1 flex items-center gap-3">
                <span className="text-sm text-muted-foreground font-mono min-w-[40px]">
                  {formatTime(currentTime)}
                </span>
                <Slider
                  value={[currentTime]}
                  max={totalDuration || 1}
                  step={0.1}
                  onValueChange={(value) => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = value[0]
                      setCurrentTime(value[0])
                    }
                  }}
                  className="flex-1"
                  disabled={!audioReady}
                />
                <span className="text-sm text-muted-foreground font-mono min-w-[40px]">
                  {formatTime(totalDuration)}
                </span>
              </div>

              <span className="text-sm text-muted-foreground truncate max-w-[180px] min-w-0">
                {fileName}
              </span>
              <div className="flex w-full sm:w-auto sm:ml-2 flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={playSynthPreview}
                  className="flex-1 sm:flex-none"
                >
                  <Music2 className="h-4 w-4 mr-2" />
                  Play Piano
                </Button>
                <Button
                  variant="outline"
                  onClick={stopSynthPlayback}
                  disabled={!isSynthPlaying}
                  className="flex-1 sm:flex-none"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
                <Button
                  variant="outline"
                  onClick={restartSynthPlayback}
                  className="flex-1 sm:flex-none"
                >
                  <SkipBack className="h-4 w-4 mr-2" />
                  Restart
                </Button>
                <Button
                  variant="outline"
                  onClick={playOverlayCompare}
                  disabled={!audioReady}
                  className="flex-1 sm:flex-none"
                >
                  <Layers className="h-4 w-4 mr-2" />
                  Play Overlay
                </Button>
                <Button
                  variant="outline"
                  onClick={stopOverlayCompare}
                  disabled={!isOverlayPlaying}
                  className="flex-1 sm:flex-none"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop Overlay
                </Button>
                <Button
                  variant="outline"
                  onClick={restartOverlayCompare}
                  disabled={!audioReady}
                  className="flex-1 sm:flex-none"
                >
                  <SkipBack className="h-4 w-4 mr-2" />
                  Restart Overlay
                </Button>
              </div>
            </div>
            {audioLoadError && (
              <p className="mt-3 text-xs text-red-600">{audioLoadError}</p>
            )}
          </div>

          {/* Need help link */}
          <div className="flex justify-center">
            <button 
              onClick={() => setHelpModalOpen(true)}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
            >
              <HelpCircle className="h-4 w-4" />
              Need help?
            </button>
          </div>
        </div>
      </main>

      {/* TEMPORARY DEBUG PANEL - Remove after testing */}
      {showDebugPanel && (
        <div className="fixed bottom-4 right-4 bg-card border border-border rounded-lg shadow-lg p-4 max-w-md text-xs font-mono z-50 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-foreground">Transcription Debug</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDebugCollapsed((prev) => !prev)}
                className="inline-flex items-center justify-center rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted"
                aria-label={debugCollapsed ? "Expand transcription debug panel" : "Collapse transcription debug panel"}
              >
                {debugCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${sourceInfo.color}`}>
                {sourceInfo.label}
              </span>
            </div>
          </div>
          {!debugCollapsed && (
            <div className="space-y-2 text-muted-foreground">
            <div className="flex gap-2">
              <span className="text-foreground shrink-0">Notes:</span> 
              <span>{detectedNotes.length}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-foreground shrink-0">Tempo:</span> 
              <span>{resolvedTempoBpm} BPM</span>
            </div>
            <div className="flex gap-2">
              <span className="text-foreground shrink-0">Pitch groups:</span>
              <span>{resolvedPitchGroups.length}</span>
            </div>
            <div>
              <span className="text-foreground">Pitches:</span>
              <div className="mt-1 break-all bg-muted/50 rounded px-2 py-1">
                {detectedNotes.length > 0 ? detectedNotes.join(', ') : 'None detected'}
              </div>
            </div>
            {resolvedPitchGroups.length > 0 && (
              <div>
                <span className="text-foreground">Pitch groups preview:</span>
                <div className="mt-1 break-all bg-muted/50 rounded px-2 py-1 max-h-24 overflow-y-auto">
                  {resolvedPitchGroups
                    .slice(0, 5)
                    .map((g) => `${g.note} ${g.startSec.toFixed(2)}s-${g.endSec.toFixed(2)}s (${g.confidence.toFixed(2)})`)
                    .join("; ")}
                </div>
              </div>
            )}
            {resolvedWarnings.length > 0 && (
              <div className="text-yellow-600">
                <span className="text-foreground">Warnings:</span> {resolvedWarnings.join(', ')}
              </div>
            )}
            <div className="pt-2 border-t border-border">
              <span className="text-foreground">Backend Source:</span>
              <div className="mt-1 bg-muted/50 rounded px-2 py-1">
                {resolvedSource}
              </div>
            </div>
            <div className="pt-2 border-t border-border">
              <span className="text-foreground">MusicXML (first 200 chars):</span>
              <div className="mt-1 break-all bg-muted/50 rounded px-2 py-1 text-[10px] leading-tight max-h-24 overflow-y-auto">
                {resolvedMusicxml ? resolvedMusicxml.substring(0, 200) + (resolvedMusicxml.length > 200 ? '...' : '') : 'No MusicXML received'}
              </div>
            </div>
            <div className="pt-2 border-t border-border text-[10px]">
              <span className="text-foreground">Render Source Explanation:</span>
              <div className="mt-1 text-muted-foreground">
                {scoreSource === "python-backend" && "Score rendered from Python backend transcription (librosa pYIN pitch detection)"}
                {scoreSource === "parse-failed" && "MusicXML received but parsing failed - showing error state"}
                {scoreSource === "no-xml" && "No MusicXML received from server - showing error state"}
                {scoreSource === "unknown" && "Unknown source - this should not happen"}
              </div>
            </div>
            </div>
          )}
        </div>
      )}

      {/* Help Request Modal */}
      <Dialog open={helpModalOpen} onOpenChange={handleCloseHelpModal}>
        <DialogContent className="sm:max-w-md">
          {!helpSubmitted ? (
            <>
              <DialogHeader>
                <DialogTitle>Need help?</DialogTitle>
                <DialogDescription>
                  {"Tell us what seems off and we'll review it and email you an updated PDF within 2–3 business days."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleHelpSubmit} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="help-email">Email</Label>
                  <Input
                    id="help-email"
                    type="email"
                    placeholder="you@example.com"
                    value={helpEmail}
                    onChange={(e) => setHelpEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="help-message">What seems wrong?</Label>
                  <Textarea
                    id="help-message"
                    placeholder="Describe what doesn't look right..."
                    value={helpMessage}
                    onChange={(e) => setHelpMessage(e.target.value)}
                    rows={4}
                    required
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleCloseHelpModal}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!canSubmitHelp}
                    className="flex-1 bg-primary hover:bg-primary/90"
                  >
                    Request Review
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-col items-center text-center py-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Request received
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                {"We'll review your draft and send an updated PDF to "}
                <span className="font-medium text-foreground">{helpEmail}</span>
                {" within 2–3 business days."}
              </p>
              <Button
                onClick={handleCloseHelpModal}
                className="bg-primary hover:bg-primary/90"
              >
                Back to result
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
