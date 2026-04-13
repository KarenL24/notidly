"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

type Props = { pieceTitle: string; fileName: string }

export default function HelpClient({ pieceTitle, fileName }: Props) {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [issue, setIssue] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSubmit = email.trim() && issue.trim() && !isSubmitting

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setIsSubmitting(true)

    setTimeout(() => {
      setIsSubmitted(true)
      setIsSubmitting(false)
    }, 800)
  }

  const handleCancel = () => {
    const params = new URLSearchParams({ title: pieceTitle, file: fileName })
    router.push(`/app/review?${params.toString()}`)
  }

  const handleBackToResult = () => {
    const params = new URLSearchParams({ title: pieceTitle, file: fileName })
    router.push(`/app/review?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
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
        <Card className="w-full max-w-md shadow-sm">
          {!isSubmitted ? (
            <>
              <CardHeader className="space-y-3 pb-4">
                <h1 className="text-xl font-semibold text-foreground text-center">
                  Need help?
                </h1>
                <p className="text-sm text-muted-foreground text-center text-balance leading-relaxed">
                  Tell us what seems off and we'll review it and email you an updated PDF within 2–3 business days.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="email"
                      className="text-sm font-medium text-foreground"
                    >
                      Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="issue"
                      className="text-sm font-medium text-foreground"
                    >
                      What seems wrong?
                    </label>
                    <Textarea
                      id="issue"
                      placeholder="Describe the issue with the generated draft..."
                      value={issue}
                      onChange={(e) => setIssue(e.target.value)}
                      rows={4}
                      required
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancel}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={!canSubmit}
                      className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {isSubmitting ? "Sending..." : "Request Review"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </>
          ) : (
            <CardContent className="py-10">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-foreground">
                    Request received
                  </h2>
                  <p className="text-sm text-muted-foreground text-balance leading-relaxed">
                    We'll review your draft and send an updated PDF to {email} within 2–3 business days.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleBackToResult}
                  className="mt-4"
                >
                  Back to result
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </main>
    </div>
  )
}
