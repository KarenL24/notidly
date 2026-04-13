"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { FileDown, HelpCircle, Play, Pause, RotateCcw, CheckCircle2 } from "lucide-react"
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

export type ReviewClientProps = {
  pieceTitle: string
  fileName: string
  pathname: string
  musicxml: string | null
  tempoBpm: string
  source: string
  isPythonBackend: boolean
  warnings: string[]
}

export default function ReviewClient({
  pieceTitle,
  fileName,
  pathname,
  musicxml,
  tempoBpm,
  source,
  isPythonBackend,
  warnings,
}: ReviewClientProps) {
  const router = useRouter()
  
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
  
  const detectedNotes = parseNotesFromMusicXML(musicxml)
  const showDebugPanel = true // TEMPORARY: Set to false to hide debug panel
  
  // Determine the actual render source - now only PYTHON_BACKEND is valid
  const getScoreSource = () => {
    if (!musicxml) return "no-xml" // No XML at all
    if (detectedNotes.length === 0) return "parse-failed" // XML didn't parse
    if (isPythonBackend) return "python-backend" // Python backend - the only valid source
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
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)
  const [audioReady, setAudioReady] = useState(false)
  
  // Audio source URL
  const audioSrc = pathname ? `/api/audio?pathname=${encodeURIComponent(pathname)}` : ""
  
  // Help modal state
  const [helpModalOpen, setHelpModalOpen] = useState(false)
  const [helpEmail, setHelpEmail] = useState("")
  const [helpMessage, setHelpMessage] = useState("")
  const [helpSubmitted, setHelpSubmitted] = useState(false)
  
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
    audio.crossOrigin = "anonymous"
    audioRef.current = audio
    
    audio.addEventListener('loadedmetadata', () => {
      setTotalDuration(audio.duration)
      setAudioReady(true)
    })
    
    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime)
    })
    
    audio.addEventListener('ended', () => {
      setIsPlaying(false)
      setCurrentTime(0)
    })
    
    audio.addEventListener('error', (e) => {
      console.error('Audio error:', e)
      setAudioReady(false)
    })
    
    return () => {
      audio.pause()
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
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
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
          <MelodyDisplay musicxml={musicxml} />

          {/* Audio player */}
          <div className="bg-secondary/50 rounded-xl px-5 py-4">
            <div className="flex items-center gap-4">
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

              <span className="text-sm text-muted-foreground truncate max-w-[180px]">
                {fileName}
              </span>
            </div>
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
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${sourceInfo.color}`}>
              {sourceInfo.label}
            </span>
          </div>
          <div className="space-y-2 text-muted-foreground">
            <div className="flex gap-2">
              <span className="text-foreground shrink-0">Notes:</span> 
              <span>{detectedNotes.length}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-foreground shrink-0">Tempo:</span> 
              <span>{tempoBpm} BPM</span>
            </div>
            <div>
              <span className="text-foreground">Pitches:</span>
              <div className="mt-1 break-all bg-muted/50 rounded px-2 py-1">
                {detectedNotes.length > 0 ? detectedNotes.join(', ') : 'None detected'}
              </div>
            </div>
            {warnings.length > 0 && (
              <div className="text-yellow-600">
                <span className="text-foreground">Warnings:</span> {warnings.join(', ')}
              </div>
            )}
            <div className="pt-2 border-t border-border">
              <span className="text-foreground">Backend Source:</span>
              <div className="mt-1 bg-muted/50 rounded px-2 py-1">
                {source}
              </div>
            </div>
            <div className="pt-2 border-t border-border">
              <span className="text-foreground">MusicXML (first 200 chars):</span>
              <div className="mt-1 break-all bg-muted/50 rounded px-2 py-1 text-[10px] leading-tight max-h-24 overflow-y-auto">
                {musicxml ? musicxml.substring(0, 200) + (musicxml.length > 200 ? '...' : '') : 'No MusicXML received'}
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
