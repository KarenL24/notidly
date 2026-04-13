"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { CheckCircle2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useState } from "react"

type Props = { pieceTitle: string; fileName: string }

export default function SuccessClient({ pieceTitle, fileName }: Props) {
  const router = useRouter()

  const handleBackToResult = () => {
    const params = new URLSearchParams({ title: pieceTitle, file: fileName })
    router.push(`/app/review?${params.toString()}`)
  }

  const [feedbackGiven, setFeedbackGiven] = useState<"yes" | "no" | null>(null)
  const [feedbackText, setFeedbackText] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const handleFeedback = (response: "yes" | "no") => {
    setFeedbackGiven(response)
  }

  const handleSubmit = () => {
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col animate-in fade-in duration-300">
      <header className="h-16 border-b border-border bg-card flex items-center px-6">
        <Image
          src="/notidly-logo.svg"
          alt="Notidly"
          width={143}
          height={57}
          className="h-9 w-auto"
          priority
        />
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-foreground">
                  Your draft PDF is ready
                </h1>
                <p className="text-sm font-medium text-foreground/80">
                  {pieceTitle}
                </p>
                <p className="text-sm text-muted-foreground">
                  Your melody draft has been exported as a PDF.
                </p>
              </div>
            </div>

            <div className="border-t border-border" />

            {!submitted ? (
              <div className="space-y-4">
                <p className="text-sm font-medium text-foreground text-center">
                  Was this useful?
                </p>

                <div className="flex items-center justify-center gap-3">
                  <Button
                    variant={feedbackGiven === "yes" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleFeedback("yes")}
                    className={feedbackGiven === "yes" ? "bg-primary hover:bg-primary/90" : ""}
                  >
                    Yes
                  </Button>
                  <Button
                    variant={feedbackGiven === "no" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleFeedback("no")}
                    className={feedbackGiven === "no" ? "bg-primary hover:bg-primary/90" : ""}
                  >
                    Not really
                  </Button>
                </div>

                {feedbackGiven && (
                  <div className="space-y-3 pt-2">
                    <label className="text-sm text-muted-foreground">
                      {feedbackGiven === "no"
                        ? "What was missing or wrong?"
                        : "Any other thoughts? (optional)"}
                    </label>
                    <Textarea
                      placeholder="Tell us more..."
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      className="resize-none h-20"
                    />
                    <Button
                      onClick={handleSubmit}
                      className="w-full bg-primary hover:bg-primary/90"
                      size="sm"
                    >
                      Submit feedback
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground">
                  Thanks for your feedback!
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleBackToResult}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to result
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
