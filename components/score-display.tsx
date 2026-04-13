"use client"

import { useRef, useEffect } from "react"

interface ScoreDisplayProps {
  sectionLabel?: string
}

export function ScoreDisplay({ sectionLabel = "INTRO" }: ScoreDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
    ctx.clearRect(0, 0, width, height)

    // Staff settings
    const staffLineSpacing = 10
    const staffHeight = staffLineSpacing * 4
    const systemSpacing = 120
    const leftMargin = 60
    const rightMargin = 40
    const topMargin = 80

    // Draw section label
    ctx.fillStyle = "#333"
    ctx.font = "600 14px system-ui, sans-serif"
    ctx.textAlign = "center"
    ctx.fillRect(width / 2 - 50, topMargin - 50, 100, 32)
    ctx.fillStyle = "#fff"
    ctx.fillText(sectionLabel, width / 2, topMargin - 30)

    // Draw two systems of grand staff
    const drawSystem = (systemY: number, measureNumber: number) => {
      ctx.fillStyle = "#333"
      ctx.strokeStyle = "#333"
      ctx.lineWidth = 1

      // Treble staff (5 lines)
      const trebleY = systemY
      for (let i = 0; i < 5; i++) {
        ctx.beginPath()
        ctx.moveTo(leftMargin, trebleY + i * staffLineSpacing)
        ctx.lineTo(width - rightMargin, trebleY + i * staffLineSpacing)
        ctx.stroke()
      }

      // Bass staff (5 lines)
      const bassY = systemY + staffHeight + 30
      for (let i = 0; i < 5; i++) {
        ctx.beginPath()
        ctx.moveTo(leftMargin, bassY + i * staffLineSpacing)
        ctx.lineTo(width - rightMargin, bassY + i * staffLineSpacing)
        ctx.stroke()
      }

      // Draw brace
      ctx.font = "bold 80px serif"
      ctx.fillText("{", leftMargin - 20, (trebleY + bassY + staffHeight) / 2 + 15)

      // Draw clefs
      ctx.font = "bold 36px serif"
      ctx.fillText("𝄞", leftMargin + 5, trebleY + 32)
      ctx.fillText("𝄢", leftMargin + 5, bassY + 28)

      // Time signature
      ctx.font = "bold 20px system-ui, sans-serif"
      ctx.fillText("4", leftMargin + 45, trebleY + 18)
      ctx.fillText("4", leftMargin + 45, trebleY + 38)
      ctx.fillText("4", leftMargin + 45, bassY + 18)
      ctx.fillText("4", leftMargin + 45, bassY + 38)

      // Key signature (two flats)
      ctx.font = "bold 24px serif"
      ctx.fillText("♭", leftMargin + 28, trebleY + 15)
      ctx.fillText("♭", leftMargin + 36, trebleY + 25)
      ctx.fillText("♭", leftMargin + 28, bassY + 25)
      ctx.fillText("♭", leftMargin + 36, bassY + 35)

      // Measure number
      ctx.font = "12px system-ui, sans-serif"
      ctx.fillText(String(measureNumber), leftMargin - 5, trebleY - 8)

      // Bar lines
      const measureWidth = (width - leftMargin - rightMargin - 60) / 4
      for (let i = 1; i <= 4; i++) {
        const x = leftMargin + 60 + i * measureWidth
        ctx.beginPath()
        ctx.moveTo(x, trebleY)
        ctx.lineTo(x, bassY + staffHeight)
        ctx.stroke()
      }

      // Draw chord symbols
      const chords = ["G", "D", "Em", "C"]
      ctx.font = "600 16px system-ui, sans-serif"
      ctx.fillStyle = "#333"
      chords.forEach((chord, i) => {
        const x = leftMargin + 60 + i * measureWidth + measureWidth / 2
        ctx.fillText(chord, x, trebleY - 15)
      })

      // Draw note heads (simple representation)
      ctx.fillStyle = "#333"
      const drawNote = (x: number, y: number, filled = true) => {
        ctx.beginPath()
        ctx.ellipse(x, y, 6, 5, -0.2, 0, Math.PI * 2)
        if (filled) {
          ctx.fill()
        } else {
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
        // Stem
        ctx.beginPath()
        ctx.moveTo(x + 5, y)
        ctx.lineTo(x + 5, y - 30)
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Draw some representative notes in each measure
      chords.forEach((_, i) => {
        const measureStart = leftMargin + 60 + i * measureWidth
        // Treble notes (chord tones)
        drawNote(measureStart + 20, trebleY + 25)
        drawNote(measureStart + 50, trebleY + 20)
        drawNote(measureStart + 80, trebleY + 30)
        // Bass notes
        drawNote(measureStart + 35, bassY + 20)
      })

      // End barline for last measure
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(width - rightMargin, trebleY)
      ctx.lineTo(width - rightMargin, bassY + staffHeight)
      ctx.stroke()
    }

    // Draw two systems
    drawSystem(topMargin, 1)
    drawSystem(topMargin + systemSpacing + 60, 5)

  }, [sectionLabel])

  return (
    <div className="w-full h-full bg-card rounded-lg p-4 flex items-center justify-center">
      <canvas
        ref={canvasRef}
        className="w-full max-w-4xl"
        style={{ height: "400px" }}
      />
    </div>
  )
}
