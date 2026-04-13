"use client"

import { ChevronDown, Music, Volume2, VolumeX, Headphones } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface NotidlySidebarProps {
  trackName: string
  trackDuration: string
}

export function NotidlySidebar({ trackName, trackDuration }: NotidlySidebarProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [isMuted, setIsMuted] = useState(false)

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col">
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="flex-1">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-4 py-6 h-auto text-foreground hover:bg-accent"
          >
            <span className="font-semibold text-base">Track</span>
            <ChevronDown
              className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
                isOpen ? "" : "-rotate-90"
              }`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4">
            {/* Track item */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                <Music className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{trackName}</p>
                <p className="text-xs text-muted-foreground">
                  Uploaded &bull; {trackDuration}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <Headphones className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Help section at bottom */}
      <div className="p-4 border-t border-border">
        <Button
          variant="link"
          className="text-sm text-muted-foreground hover:text-primary p-0 h-auto"
        >
          Need help?
        </Button>
      </div>
    </aside>
  )
}
