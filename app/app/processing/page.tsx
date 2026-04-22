import ProcessingClient from "./processing-client"
import { searchParamFirst } from "@/lib/search-params"

export default async function ProcessingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const pieceTitle = searchParamFirst(sp, "title") || "Untitled"
  const fileName = searchParamFirst(sp, "file") || "audio.mp3"
  const pathname = searchParamFirst(sp, "pathname") || ""
  const blobUrl = searchParamFirst(sp, "blobUrl") || ""

  return (
    <ProcessingClient
      pieceTitle={pieceTitle}
      fileName={fileName}
      pathname={pathname}
      blobUrl={blobUrl}
    />
  )
}
