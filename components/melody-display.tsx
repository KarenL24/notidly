"use client"

import { useRef, useEffect, useMemo, useState } from "react"

interface Note {
  pitch: string
  octave: number
  duration: number
  type: string
}

interface Measure {
  notes: Note[]
}

interface MelodyDisplayProps {
  musicxml?: string | null
  /** Explicitly enable demo mode for testing - shows placeholder melody */
  demoMode?: boolean
}

// Parse MusicXML to extract notes
function parseMusicXML(xml: string): Measure[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, "text/xml")
  const measures: Measure[] = []

  const measureElements = doc.querySelectorAll("measure")
  measureElements.forEach((measureEl) => {
    const notes: Note[] = []
    const noteElements = measureEl.querySelectorAll("note")
    
    noteElements.forEach((noteEl) => {
      const pitchEl = noteEl.querySelector("pitch")
      if (pitchEl) {
        const step = pitchEl.querySelector("step")?.textContent || "C"
        const octave = parseInt(pitchEl.querySelector("octave")?.textContent || "4")
        const duration = parseInt(noteEl.querySelector("duration")?.textContent || "1")
        const type = noteEl.querySelector("type")?.textContent || "quarter"
        
        notes.push({ pitch: step, octave, duration, type })
      }
    })
    
    if (notes.length > 0) {
      measures.push({ notes })
    }
  })

  return measures
}

// Convert pitch to staff position (0 = B4 middle line)
function pitchToStaffPosition(pitch: string, octave: number): number {
  const pitchMap: Record<string, number> = {
    'C': -6, 'D': -5, 'E': -4, 'F': -3, 'G': -2, 'A': -1, 'B': 0
  }
  const base = pitchMap[pitch] || 0
  const octaveOffset = (octave - 4) * 7
  return base + octaveOffset
}

export function MelodyDisplay({ musicxml, demoMode = false }: MelodyDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mounted, setMounted] = useState(false)

  // Track when component has mounted to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Parse MusicXML if provided - only on client to avoid SSR mismatch with DOMParser
  const parsedMeasures = useMemo(() => {
    if (!mounted) return null // Don't parse during SSR
    if (musicxml) {
      try {
        return parseMusicXML(musicxml)
      } catch {
        return null
      }
    }
    return null
  }, [musicxml, mounted])

  // Determine if we have valid notation to render
  const hasValidNotation = (parsedMeasures && parsedMeasures.length > 0) || demoMode
  
  // Only show error state after mount to avoid hydration mismatch
  const showErrorState = mounted && !hasValidNotation

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set up canvas for high DPI
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const width = rect.width
    const height = rect.height

    // Clear canvas
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, width, height)

    // Engraving colors
    const inkColor = "#1a1a1a"
    
    // Staff settings
    const staffLineSpacing = 10
    const staffHeight = staffLineSpacing * 4
    const leftMargin = 50
    const rightMargin = 30
    const topPadding = 45
    const staffY = topPadding

    ctx.fillStyle = inkColor
    ctx.strokeStyle = inkColor

    // Draw 5 staff lines
    ctx.lineWidth = 0.8
    for (let i = 0; i < 5; i++) {
      ctx.beginPath()
      ctx.moveTo(leftMargin, staffY + i * staffLineSpacing)
      ctx.lineTo(width - rightMargin, staffY + i * staffLineSpacing)
      ctx.stroke()
    }

    // Draw treble clef
    ctx.save()
    ctx.font = "58px Baskerville, Georgia, serif"
    ctx.fillText("𝄞", leftMargin + 2, staffY + 32)
    ctx.restore()

    // Time signature
    ctx.font = "bold 18px 'Times New Roman', Times, serif"
    ctx.textAlign = "center"
    ctx.fillText("4", leftMargin + 55, staffY + 15)
    ctx.fillText("4", leftMargin + 55, staffY + 35)
    ctx.textAlign = "left"

    // Calculate measure positions
    const scoreStartX = leftMargin + 75
    const scoreWidth = width - scoreStartX - rightMargin
    const numMeasures = parsedMeasures ? Math.max(parsedMeasures.length, 4) : 4
    const measureWidth = scoreWidth / numMeasures

    // Draw barlines
    const drawBarline = (x: number, isFinal = false) => {
      ctx.lineWidth = isFinal ? 2.5 : 0.8
      ctx.beginPath()
      ctx.moveTo(x, staffY)
      ctx.lineTo(x, staffY + staffHeight)
      ctx.stroke()
      if (isFinal) {
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.moveTo(x - 6, staffY)
        ctx.lineTo(x - 6, staffY + staffHeight)
        ctx.stroke()
      }
    }

    for (let i = 1; i < numMeasures; i++) {
      drawBarline(scoreStartX + i * measureWidth)
    }
    drawBarline(width - rightMargin, true)

    // Note drawing functions
    const getNoteY = (staffPosition: number) => {
      return staffY + 2 * staffLineSpacing - (staffPosition * staffLineSpacing / 2)
    }

    const drawNoteHead = (x: number, y: number, filled = true) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(-0.18)
      ctx.beginPath()
      ctx.ellipse(0, 0, 5.5, 4, 0, 0, Math.PI * 2)
      if (filled) {
        ctx.fill()
      } else {
        ctx.lineWidth = 1.2
        ctx.stroke()
      }
      ctx.restore()
    }

    const drawStem = (x: number, y: number, up = true) => {
      ctx.lineWidth = 1
      const stemLength = 28
      const offsetX = up ? 5 : -5
      ctx.beginPath()
      ctx.moveTo(x + offsetX, y)
      ctx.lineTo(x + offsetX, y + (up ? -stemLength : stemLength))
      ctx.stroke()
    }

    const drawLedgerLine = (x: number, y: number) => {
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(x - 8, y)
      ctx.lineTo(x + 8, y)
      ctx.stroke()
    }

    const drawNote = (x: number, staffPos: number, type: string) => {
      const y = getNoteY(staffPos)
      const stemUp = staffPos < 1
      
      // Ledger lines if needed
      if (staffPos >= 6) {
        for (let i = 6; i <= staffPos; i += 2) {
          drawLedgerLine(x, getNoteY(i))
        }
      }
      if (staffPos <= -6) {
        for (let i = -6; i >= staffPos; i -= 2) {
          drawLedgerLine(x, getNoteY(i))
        }
      }

      if (type === "whole") {
        ctx.save()
        ctx.translate(x, y)
        ctx.beginPath()
        ctx.ellipse(0, 0, 6, 4.5, 0, 0, Math.PI * 2)
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.beginPath()
        ctx.ellipse(0, 0, 3, 3, 0.5, 0, Math.PI * 2)
        ctx.fillStyle = "#ffffff"
        ctx.fill()
        ctx.restore()
      } else if (type === "half") {
        drawNoteHead(x, y, false)
        drawStem(x, y, stemUp)
      } else {
        // quarter, eighth, etc.
        drawNoteHead(x, y, true)
        drawStem(x, y, stemUp)
      }
    }

    // Render notes from MusicXML
    if (parsedMeasures && parsedMeasures.length > 0) {
      parsedMeasures.forEach((measure, measureIndex) => {
        const measureStartX = scoreStartX + measureIndex * measureWidth + 15
        const noteSpacing = (measureWidth - 30) / Math.max(measure.notes.length, 1)
        
        measure.notes.forEach((note, noteIndex) => {
          const x = measureStartX + noteIndex * noteSpacing
          const staffPos = pitchToStaffPosition(note.pitch, note.octave)
          drawNote(x, staffPos, note.type)
        })
      })
    } else if (demoMode) {
      // DEMO MODE ONLY: Show placeholder melody for testing
      const m1 = scoreStartX + 15
      drawNote(m1, 0, "quarter")
      drawNote(m1 + 32, 1, "quarter")
      drawNote(m1 + 60, 2, "quarter")
      drawNote(m1 + 88, 3, "quarter")

      const m2 = scoreStartX + measureWidth + 12
      drawNote(m2, 4, "half")
      drawNote(m2 + 60, 2, "half")

      const m3 = scoreStartX + measureWidth * 2 + 12
      drawNote(m3, 1, "quarter")
      drawNote(m3 + 30, 0, "quarter")
      drawNote(m3 + 60, 1, "quarter")
      drawNote(m3 + 90, 2, "quarter")

      const m4 = scoreStartX + measureWidth * 3 + 12
      drawNote(m4 + 40, 0, "whole")
    }
    // If neither parsedMeasures nor demoMode, empty staff lines remain (error state handled in JSX)

  }, [parsedMeasures, demoMode])

  return (
    <div className="w-full bg-card rounded-xl border border-border overflow-hidden relative">
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: "130px" }}
      />
      {/* Error state overlay when no valid notation - only after mount to avoid hydration mismatch */}
      {showErrorState && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/90">
          <div className="text-center px-6">
            <p className="text-muted-foreground text-sm">
              {"We couldn't generate a readable draft from this audio."}
            </p>
            <p className="text-muted-foreground/70 text-xs mt-1">
              Try uploading a clearer recording with a single voice.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
