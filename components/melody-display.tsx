"use client"

import { useEffect, useState } from "react"
import { VerovioToolkit } from "verovio/esm"
import createVerovioModule from "verovio/wasm"

interface MelodyDisplayProps {
  musicxml?: string | null
}

export function MelodyDisplay({ musicxml }: MelodyDisplayProps) {
  const [mounted, setMounted] = useState(false)
  const [svg, setSvg] = useState<string | null>(null)
  const [renderError, setRenderError] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let cancelled = false

    const renderWithVerovio = async () => {
      if (!mounted || !musicxml) {
        setSvg(null)
        setRenderError(false)
        return
      }

      try {
        const module = await createVerovioModule()
        if (cancelled) return

        const toolkit = new VerovioToolkit(module)
        toolkit.setOptions({
          scale: 42,
          pageWidth: 1400,
          pageHeight: 280,
          adjustPageHeight: true,
          breaks: "encoded",
          footer: "none",
          header: "none",
        })
        toolkit.loadData(musicxml)
        const rendered = toolkit.renderToSVG(1, {})

        if (!rendered || cancelled) return
        setSvg(rendered)
        setRenderError(false)
      } catch (error) {
        console.error("Failed to render MusicXML with Verovio:", error)
        if (!cancelled) {
          setSvg(null)
          setRenderError(true)
        }
      }
    }

    renderWithVerovio()
    return () => {
      cancelled = true
    }
  }, [mounted, musicxml])

  const showErrorState = mounted && (!musicxml || renderError || !svg)

  return (
    <div className="w-full bg-card rounded-xl border border-border overflow-hidden relative">
      {svg ? (
        <div
          className="w-full overflow-x-auto p-3"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="h-[150px] w-full" />
      )}
      {showErrorState && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/90">
          <div className="text-center px-6">
            <p className="text-muted-foreground text-sm">
              {"We couldn't generate a readable draft from this audio."}
            </p>
            <p className="text-muted-foreground/70 text-xs mt-1">
              Try uploading a clearer recording with a single voice.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
