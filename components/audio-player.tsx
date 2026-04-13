"use client"

import { useState, useRef, useEffect } from "react"
import { Play, Pause, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"

interface AudioPlayerProps {
  fileName: string
  duration: string
}

export function AudioPlayer({ fileName, duration }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration] = useState(26) // 0:26 in seconds
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalDuration) {
            setIsPlaying(false)
            return 0
          }
          return prev + 0.1
        })
      }, 100)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isPlaying, totalDuration])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handleRestart = () => {
    setCurrentTime(0)
    setIsPlaying(false)
  }

  const handleSliderChange = (value: number[]) => {
    setCurrentTime(value[0])
  }

  return (
    <div className="flex items-center gap-3 bg-secondary/50 rounded-lg px-4 py-3">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={handleRestart}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90"
          onClick={handlePlayPause}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5 fill-primary-foreground text-primary-foreground" />
          ) : (
            <Play className="h-5 w-5 fill-primary-foreground text-primary-foreground ml-0.5" />
          )}
        </Button>
      </div>

      <div className="flex-1 flex items-center gap-3">
        <span className="text-sm text-muted-foreground font-mono min-w-[40px]">
          {formatTime(currentTime)}
        </span>
        <Slider
          value={[currentTime]}
          max={totalDuration}
          step={0.1}
          onValueChange={handleSliderChange}
          className="flex-1"
        />
        <span className="text-sm text-muted-foreground font-mono min-w-[40px]">
          {duration}
        </span>
      </div>

      <div className="text-sm text-muted-foreground truncate max-w-[200px]">
        {fileName}
      </div>
    </div>
  )
}
