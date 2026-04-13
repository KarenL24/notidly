import ProcessingErrorClient from "./processing-error-client"
import { searchParamFirst } from "@/lib/search-params"

export default async function ProcessingErrorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const g = (key: string) => searchParamFirst(sp, key) ?? ""

  return (
    <ProcessingErrorClient
      errorCode={g("errorCode") || "UNKNOWN"}
      errorMessage={g("error")}
      debugSource={g("debugSource") || "FAILURE_STATE"}
      pythonBackendUrl={g("pythonBackendUrl")}
      debugFormat={g("debugFormat")}
      debugDecoded={g("debugDecoded") === "true"}
      debugVoiced={g("debugVoiced") || "0"}
      debugTotal={g("debugTotal") || "0"}
      debugFailure={g("debugFailure")}
    />
  )
}
