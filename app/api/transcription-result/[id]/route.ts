import { type NextRequest, NextResponse } from "next/server"
import { getTranscriptionResult } from "@/lib/transcription-results"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing result id" }, { status: 400 })
  }

  const result = getTranscriptionResult(id)
  if (!result) {
    return NextResponse.json(
      { success: false, error: "Result not found or expired" },
      { status: 404 }
    )
  }

  return NextResponse.json({
    success: true,
    result: {
      musicxml: result.musicxml,
      tempoBpm: result.tempoBpm,
      source: result.source,
      isPythonBackend: result.isPythonBackend,
      warnings: result.warnings,
      pitchGroups: result.pitchGroups,
    },
  })
}
