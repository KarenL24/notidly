import { type NextRequest, NextResponse } from "next/server"
import { saveTranscriptionResult } from "@/lib/transcription-results"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const musicxml = typeof body.musicxml === "string" ? body.musicxml : null
    const tempoBpm = String(body.tempoBpm ?? "0")
    const source = String(body.source ?? "UNKNOWN")
    const isPythonBackend = Boolean(body.isPythonBackend)
    const warnings = Array.isArray(body.warnings) ? body.warnings.map(String) : []
    const pitchGroups = Array.isArray(body.pitchGroups) ? body.pitchGroups : []

    const resultId = saveTranscriptionResult({
      musicxml,
      tempoBpm,
      source,
      isPythonBackend,
      warnings,
      pitchGroups,
    })

    return NextResponse.json({ success: true, resultId })
  } catch (error) {
    console.error("Failed to store transcription result:", error)
    return NextResponse.json(
      { success: false, error: "Failed to store transcription result" },
      { status: 500 }
    )
  }
}
