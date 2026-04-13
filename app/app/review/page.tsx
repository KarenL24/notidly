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
      musicxml={musicxml}
      tempoBpm={g("tempoBpm") || "0"}
      source={g("source") || "UNKNOWN"}
      isPythonBackend={g("isPythonBackend") === "true"}
      warnings={parseWarnings(g("warnings"))}
    />
  )
}
