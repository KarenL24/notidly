"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Check } from "lucide-react"

const STEPS = [
  { label: "Upload received", delay: 800 },
  { label: "Extracting melody", delay: 2500 },
  { label: "Preparing notation", delay: 4000 },
]

type Props = {
  pieceTitle: string
  fileName: string
  pathname: string
  blobUrl: string
}

export default function ProcessingClient({
  pieceTitle,
  fileName,
  pathname,
  blobUrl,
}: Props) {
  const router = useRouter()
  const [completedSteps, setCompletedSteps] = useState<number[]>([])

  useEffect(() => {
    const stepTimers = STEPS.map((step, index) => {
      return setTimeout(() => {
        setCompletedSteps((prev) => [...prev, index])
      }, step.delay)
    })

    const transcribe = async () => {
      try {
        const response = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pathname, title: pieceTitle, blobUrl }),
        })

        const data = await response.json()

        if (!response.ok || !data.success) {
          const errorParams = new URLSearchParams({
            errorCode: data.errorCode || 'UNKNOWN',
            error: data.error || 'Transcription failed',
            debugSource: data.debugSource || 'FAILURE_STATE',
            pythonBackendUrl: data.pythonBackendUrl || '',
            debugFormat: data.jsDebug?.detectedFormat || '',
            debugDecoded: data.jsDebug?.decodingSucceeded ? 'true' : 'false',
            debugVoiced: String(data.jsDebug?.voicedFrames || 0),
            debugTotal: String(data.jsDebug?.totalFrames || 0),
            debugFailure: data.jsDebug?.failureReason || ''
          })
          router.push(`/app/processing/error?${errorParams.toString()}`)
          return
        }

        const params = new URLSearchParams({ 
          title: pieceTitle, 
          file: fileName,
          pathname: pathname,
          musicxml: encodeURIComponent(data.musicxml),
          tempoBpm: String(data.tempoBpm || 0),
          source: data.source || 'UNKNOWN',
          isPythonBackend: data.isPythonBackend ? 'true' : 'false',
          warnings: JSON.stringify(data.warnings || [])
        })
        router.push(`/app/review?${params.toString()}`)
      } catch (error) {
        console.error('Transcription error:', error)
        router.push('/app/processing/error')
      }
    }

    const transcribeTimer = setTimeout(transcribe, 4500)

    return () => {
      stepTimers.forEach(t => clearTimeout(t))
      clearTimeout(transcribeTimer)
    }
  }, [router, pieceTitle, fileName, pathname, blobUrl])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="w-full max-w-md">
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
              <div className="relative mb-6">
                <Spinner className="h-12 w-12 text-primary" />
              </div>

              <h1 className="text-xl font-semibold text-foreground mb-1">
                Generating Draft
              </h1>
              
              <p className="text-sm font-medium text-foreground/80 mb-2">
                {pieceTitle}
              </p>

              <p className="text-sm text-muted-foreground mb-8">
                {"We're analyzing your audio and creating a melody sheet."}
              </p>

              <div className="w-full space-y-3 mb-6">
                {STEPS.map((step, index) => {
                  const isCompleted = completedSteps.includes(index)
                  const isActive =
                    !isCompleted &&
                    (index === 0 || completedSteps.includes(index - 1))

                  return (
                    <div
                      key={step.label}
                      className="flex items-center gap-3 text-left"
                    >
                      <div
                        className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                          isCompleted
                            ? "bg-primary"
                            : isActive
                              ? "border-2 border-primary"
                              : "border-2 border-muted-foreground/30"
                        }`}
                      >
                        {isCompleted && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                        {isActive && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <span
                        className={`text-sm ${
                          isCompleted
                            ? "text-foreground"
                            : isActive
                              ? "text-foreground"
                              : "text-muted-foreground"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  )
                })}
              </div>

              <p className="text-xs text-muted-foreground mb-2">
                Usually ready in under a minute
              </p>

              <p className="text-xs text-muted-foreground/70">
                This creates a draft, not a final score.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
