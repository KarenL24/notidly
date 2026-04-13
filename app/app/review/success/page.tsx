import SuccessClient from "./success-client"
import { searchParamFirst } from "@/lib/search-params"

export default async function ExportSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  return (
    <SuccessClient
      pieceTitle={searchParamFirst(sp, "title") || "Untitled"}
      fileName={searchParamFirst(sp, "file") || "audio.mp3"}
    />
  )
}
