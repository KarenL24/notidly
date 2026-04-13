import HelpClient from "./help-client"
import { searchParamFirst } from "@/lib/search-params"

export default async function HelpRequestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  return (
    <HelpClient
      pieceTitle={searchParamFirst(sp, "title") || "Untitled"}
      fileName={searchParamFirst(sp, "file") || "audio.mp3"}
    />
  )
}
