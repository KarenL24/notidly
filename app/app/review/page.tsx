import ReviewClient from "./review-client"
import { searchParamFirst } from "@/lib/search-params"

function parseWarnings(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map(String)
  } catch {
    return []
  }
}

type PitchGroup = {
  startSec: number
  endSec: number
  midi: number
  note: string
  confidence: number
}

function parsePitchGroups(raw: string | undefined): PitchGroup[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const v = item as Record<string, unknown>
        return {
          startSec: Number(v.startSec || 0),
          endSec: Number(v.endSec || 0),
          midi: Number(v.midi || 0),
          note: String(v.note || ""),
          confidence: Number(v.confidence || 0),
        }
      })
  } catch {
    return []
  }
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const g = (key: string) => searchParamFirst(sp, key)
  const musicxmlEncoded = g("musicxml")
  const musicxml = musicxmlEncoded ? decodeURIComponent(musicxmlEncoded) : null

  return (
    <ReviewClient
      pieceTitle={g("title") || "Untitled"}
      fileName={g("file") || "audio.mp3"}
      pathname={g("pathname") || ""}
      resultId={g("resultId") || null}
      musicxml={musicxml}
      tempoBpm={g("tempoBpm") || "0"}
      source={g("source") || "UNKNOWN"}
      isPythonBackend={g("isPythonBackend") === "true"}
      warnings={parseWarnings(g("warnings"))}
      pitchGroups={parsePitchGroups(g("pitchGroups"))}
    />
  )
}
