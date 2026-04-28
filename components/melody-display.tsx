"use client"

import { useEffect, useState } from "react"
import { VerovioToolkit } from "verovio/esm"
import createVerovioModule from "verovio/wasm"

interface MelodyDisplayProps {
  musicxml?: string | null
}

export function MelodyDisplay({ musicxml }: MelodyDisplayProps) {
  const [mounted, setMounted] = useState(false)
  const [svgPages, setSvgPages] = useState<string[]>([])
  const [renderError, setRenderError] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let cancelled = false

    const renderWithVerovio = async () => {
      if (!mounted || !musicxml) {
        setSvgPages([])
        setRenderError(false)
        return
      }

      try {
        const module = await createVerovioModule()
        if (cancelled) return

        const toolkit = new VerovioToolkit(module)
        toolkit.setOptions({
          scale: 38,
          pageWidth: 950,
          pageHeight: 1200,
          adjustPageHeight: true,
          breaks: "line",
          footer: "none",
          header: "none",
        })
        toolkit.loadData(musicxml)
        const pageCount = toolkit.getPageCount()
        const pages: string[] = []
        for (let page = 1; page <= pageCount; page++) {
          const rendered = toolkit.renderToSVG(page, {})
          if (rendered) pages.push(rendered)
        }

        if (pages.length === 0 || cancelled) return
        setSvgPages(pages)
        setRenderError(false)
      } catch (error) {
        console.error("Failed to render MusicXML with Verovio:", error)
        if (!cancelled) {
          setSvgPages([])
          setRenderError(true)
        }
      }
    }

    renderWithVerovio()
    return () => {
      cancelled = true
    }
  }, [mounted, musicxml])

  const showErrorState = mounted && (!musicxml || renderError || svgPages.length === 0)

  return (
    <div className="w-full bg-card rounded-xl border border-border overflow-hidden relative">
      {svgPages.length > 0 ? (
        <div className="w-full p-3 space-y-4">
          {svgPages.map((svg, index) => (
            <div
              key={index}
              className="w-full bg-white border border-border rounded-md p-2 overflow-hidden"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ))}
        </div>
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
