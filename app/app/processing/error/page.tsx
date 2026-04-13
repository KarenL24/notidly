"use client"

import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, Check, ArrowLeft } from "lucide-react"

const BEST_PRACTICES = [
  "One clear solo voice",
  "Under 30 seconds",
  "Quiet recording, minimal background noise",
]

export default function ProcessingErrorPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Get debug info from query params
  const errorCode = searchParams.get("errorCode") || "UNKNOWN"
  const errorMessage = searchParams.get("error") || ""
  const debugSource = searchParams.get("debugSource") || "FAILURE_STATE"
  const pythonBackendUrl = searchParams.get("pythonBackendUrl") || ""
  // JS debug info (for diagnostics only - not used for rendering)
  const debugFormat = searchParams.get("debugFormat") || ""
  const debugDecoded = searchParams.get("debugDecoded") === "true"
  const debugVoiced = searchParams.get("debugVoiced") || "0"
  const debugTotal = searchParams.get("debugTotal") || "0"
  const debugFailure = searchParams.get("debugFailure") || ""
  
  const showDebugPanel = true // TEMPORARY: Set to false to hide debug panel
  const isPythonUnavailable = errorCode === "PYTHON_BACKEND_UNAVAILABLE"

  const handleTryAgain = () => {
    router.push("/app")
  }

  const handleBack = () => {
    router.back()
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/notidly-logo.svg"
            alt="Notidly"
            width={180}
            height={72}
            className="h-14 w-auto"
            priority
          />
        </div>

        <Card className="border-border shadow-sm">
          <CardContent className="py-10 px-8">
            <div className="flex flex-col items-center text-center">
              {/* Error icon */}
              <div className="mb-6 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>

              {/* Error message */}
              <h1 className="text-xl font-semibold text-foreground mb-2">
                {"We couldn't generate a reliable melody from this clip."}
              </h1>

              {/* Supporting text */}
              <p className="text-sm text-muted-foreground mb-6">
                For best results, try a recording with:
              </p>

              {/* Best practices checklist */}
              <div className="w-full space-y-3 mb-8 text-left">
                {BEST_PRACTICES.map((practice) => (
                  <div key={practice} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                      <Check className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <span className="text-sm text-foreground">{practice}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="w-full space-y-3">
                <Button onClick={handleTryAgain} className="w-full bg-primary hover:bg-primary/90 transition-colors">
                  Try another file
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  className="w-full text-muted-foreground"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* TEMPORARY DEBUG PANEL - Remove after testing */}
        {showDebugPanel && (
          <div className="mt-4 bg-card border border-border rounded-lg shadow-lg p-4 text-xs font-mono">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-foreground">Transcription Debug</span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-800">
                {debugSource}
              </span>
            </div>
            <div className="space-y-1.5 text-muted-foreground">
              <div><span className="text-foreground">Error Code:</span> {errorCode}</div>
              {isPythonUnavailable && pythonBackendUrl && (
                <div className="pt-2 border-t border-border">
                  <span className="text-foreground">Python Backend URL:</span>
                  <div className="mt-1 break-all bg-muted/50 rounded px-2 py-1">
                    {pythonBackendUrl}
                  </div>
                  <div className="mt-2 text-yellow-600 text-[10px]">
                    To fix: Deploy the Python FastAPI backend and set TRANSCRIPTION_API_URL environment variable.
                  </div>
                </div>
              )}
              {debugFormat && (
                <div className="pt-2 border-t border-border">
                  <span className="text-foreground">JS Debug Info (diagnostics only):</span>
                  <div className="mt-1 space-y-1 bg-muted/50 rounded px-2 py-1">
                    <div><span className="text-foreground">Format:</span> {debugFormat}</div>
                    <div><span className="text-foreground">Decoding:</span> {debugDecoded ? 'Success' : 'Failed'}</div>
                    <div><span className="text-foreground">Voiced Frames:</span> {debugVoiced} / {debugTotal}</div>
                  </div>
                </div>
              )}
              {debugFailure && (
                <div className="pt-2 border-t border-border">
                  <span className="text-foreground">JS Failure Reason:</span>
                  <div className="mt-1 break-all bg-muted/50 rounded px-2 py-1">
                    {debugFailure}
                  </div>
                </div>
              )}
              {errorMessage && (
                <div className="pt-2 border-t border-border">
                  <span className="text-foreground">Error Message:</span>
                  <div className="mt-1 break-all bg-muted/50 rounded px-2 py-1">
                    {errorMessage}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
