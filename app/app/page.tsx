"use client"

import { useState, useRef, useCallback } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, FileAudio, X, CheckCircle2, AlertCircle } from "lucide-react"

// Currently only WAV is supported for JS-based transcription
const WAV_AUDIO_TYPES = ["audio/wav", "audio/x-wav"]
const ACCEPTED_EXTENSIONS = ".wav"

export default function UploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [pieceTitle, setPieceTitle] = useState("")
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [fileError, setFileError] = useState("")
  const [isUploading, setIsUploading] = useState(false)

  const isWavFile = (file: File) => {
    return WAV_AUDIO_TYPES.includes(file.type) || 
           file.name.toLowerCase().endsWith('.wav')
  }

  const getUnsupportedFormatMessage = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    const formatNames: Record<string, string> = {
      'mp3': 'MP3',
      'm4a': 'M4A (voice memo)',
      'webm': 'WebM (browser recording)',
      'ogg': 'OGG',
      'aiff': 'AIFF',
      'mp4': 'MP4',
    }
    const formatName = formatNames[ext] || ext.toUpperCase()
    return `${formatName} files are not yet supported. Please convert to WAV format and try again.`
  }

  const handleFile = useCallback((file: File) => {
    setFileError("")
    if (isWavFile(file)) {
      setAudioFile(file)
    } else {
      setFileError(getUnsupportedFormatMessage(file.name))
      setAudioFile(null)
    }
  }, [])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [handleFile])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const removeFile = () => {
    setAudioFile(null)
    setFileError("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pieceTitle.trim() || !audioFile || isUploading) return

    setIsUploading(true)
    setFileError("")

    try {
      // Upload file to Vercel Blob
      const formData = new FormData()
      formData.append('file', audioFile)
      formData.append('title', pieceTitle.trim())

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        throw new Error('Upload failed')
      }

      const { pathname } = await uploadResponse.json()

      // Navigate to processing with blob pathname
      const params = new URLSearchParams({ 
        title: pieceTitle.trim(), 
        file: audioFile.name,
        pathname: pathname 
      })
      router.push(`/app/processing?${params.toString()}`)
    } catch (error) {
      console.error('Upload error:', error)
      setFileError('Failed to upload file. Please try again.')
      setIsUploading(false)
    }
  }

  const canSubmit = pieceTitle.trim() !== "" && audioFile !== null

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="w-full max-w-lg">
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
            {/* Page Title */}
            <h1 className="text-2xl font-semibold text-foreground text-center mb-2">
              Create Draft
            </h1>
            <p className="text-muted-foreground text-center text-sm mb-8">
              Upload a short solo vocal WAV recording to generate a printable melody draft.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Piece Title Input */}
              <div className="space-y-2">
                <label htmlFor="pieceTitle" className="text-sm font-medium text-foreground">
                  Piece Title
                </label>
                <Input
                  id="pieceTitle"
                  type="text"
                  placeholder="Enter title..."
                  value={pieceTitle}
                  onChange={(e) => setPieceTitle(e.target.value)}
                />
              </div>

              {/* Audio Upload Area */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Audio File
                </label>
                
                {!audioFile ? (
                  <div
                    className={`
                      relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
                      ${dragActive 
                        ? "border-primary bg-primary/5" 
                        : fileError 
                          ? "border-destructive bg-destructive/5" 
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      }
                    `}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED_EXTENSIONS}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    
                    <Upload className={`h-10 w-10 mx-auto mb-3 ${fileError ? "text-destructive" : "text-muted-foreground"}`} />
                    
                    <p className="text-sm text-foreground font-medium mb-1">
                      Drop your audio file here
                    </p>
                    <p className="text-xs text-muted-foreground">
                      or click to browse
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
                      <FileAudio className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {audioFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={removeFile}
                      className="p-1.5 rounded-full hover:bg-muted transition-colors"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                )}

                {fileError && (
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p className="text-sm">{fileError}</p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  WAV format only (MP3, M4A, WebM not yet supported)
                </p>
              </div>

              {/* Best Results Tips */}
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium text-foreground mb-2">Best results</p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    One clear solo voice
                  </li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    Under 30 seconds
                  </li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    Quiet recording, minimal background noise
                  </li>
                </ul>
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 transition-colors"
                disabled={!canSubmit || isUploading}
              >
                {isUploading ? "Uploading..." : "Generate Draft"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
