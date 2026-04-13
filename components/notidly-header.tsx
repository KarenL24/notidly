"use client"

import Image from "next/image"
import { FileDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface NotidlyHeaderProps {
  projectTitle: string
  onExportPdf: () => void
}

export function NotidlyHeader({ projectTitle, onExportPdf }: NotidlyHeaderProps) {
  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
      {/* Left: Logo and title */}
      <div className="flex items-center gap-6">
        <Image
          src="/notidly-logo.svg"
          alt="Notidly"
          width={143}
          height={57}
          className="h-10 w-auto"
          priority
        />
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-3">
          <h1 className="text-base text-foreground">{projectTitle}</h1>
          <Badge
            variant="secondary"
            className="bg-amber-100 text-amber-700 hover:bg-amber-100 font-medium"
          >
            Draft
          </Badge>
        </div>
      </div>

      {/* Right: Status and export */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Saved</span>
        <Button
          onClick={onExportPdf}
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
        >
          <FileDown className="h-4 w-4" />
          Export PDF
        </Button>
      </div>
    </header>
  )
}
