"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2 } from "lucide-react"

const VALID_ACCESS_CODE = "NOTIDLY"

export default function EntryPage() {
  const router = useRouter()
  const [accessCode, setAccessCode] = useState("")
  const [accessError, setAccessError] = useState("")
  
  const [waitlistName, setWaitlistName] = useState("")
  const [waitlistEmail, setWaitlistEmail] = useState("")
  const [waitlistUseCase, setWaitlistUseCase] = useState("")
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false)

  const handleAccessSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (accessCode.toUpperCase() === VALID_ACCESS_CODE) {
      setAccessError("")
      router.push("/app")
    } else {
      setAccessError("Invalid access code. Please try again.")
    }
  }

  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In a real app, this would send to a backend
    setWaitlistSubmitted(true)
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
          <CardContent className="pt-8 pb-8 px-8">
            {/* Headline */}
            <h1 className="text-2xl font-semibold text-foreground text-center mb-2">
              Try Notidly
            </h1>
            <p className="text-muted-foreground text-center text-sm mb-8">
              Enter your access code to access the MVP, or join the waitlist for early access.
            </p>

            {/* Access Code Form */}
            <form onSubmit={handleAccessSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Access code"
                  value={accessCode}
                  onChange={(e) => {
                    setAccessCode(e.target.value)
                    setAccessError("")
                  }}
                  className={accessError ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {accessError && (
                  <p className="text-sm text-destructive">{accessError}</p>
                )}
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 transition-colors">
                Enter App
              </Button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-8">
              <div className="flex-1 h-px bg-border" />
              <span className="text-sm text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Waitlist Form */}
            {waitlistSubmitted ? (
              <div className="text-center py-4">
                <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-3" />
                <p className="text-foreground font-medium">{"You're on the list!"}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {"We'll be in touch when your access is ready."}
                </p>
              </div>
            ) : (
              <form onSubmit={handleWaitlistSubmit} className="space-y-4">
                <Input
                  type="text"
                  placeholder="Name"
                  value={waitlistName}
                  onChange={(e) => setWaitlistName(e.target.value)}
                  required
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  required
                />
                <Textarea
                  placeholder="How would you use this?"
                  value={waitlistUseCase}
                  onChange={(e) => setWaitlistUseCase(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <Button type="submit" variant="secondary" className="w-full">
                  Join Waitlist
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
