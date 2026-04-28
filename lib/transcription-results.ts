import { randomUUID } from "crypto"

export type StoredPitchGroup = {
  startSec: number
  endSec: number
  midi: number
  note: string
  confidence: number
}

export type StoredTranscriptionResult = {
  musicxml: string | null
  tempoBpm: string
  source: string
  isPythonBackend: boolean
  warnings: string[]
  pitchGroups: StoredPitchGroup[]
  createdAt: number
}

const RESULT_TTL_MS = 1000 * 60 * 30
const MAX_RESULTS = 200
const results = new Map<string, StoredTranscriptionResult>()

function pruneExpired(now = Date.now()) {
  for (const [id, value] of results.entries()) {
    if (now - value.createdAt > RESULT_TTL_MS) {
      results.delete(id)
    }
  }
}

export function saveTranscriptionResult(
  result: Omit<StoredTranscriptionResult, "createdAt">
): string {
  pruneExpired()
  if (results.size >= MAX_RESULTS) {
    const firstKey = results.keys().next().value
    if (firstKey) {
      results.delete(firstKey)
    }
  }

  const id = randomUUID()
  results.set(id, {
    ...result,
    createdAt: Date.now(),
  })
  return id
}

export function getTranscriptionResult(id: string): StoredTranscriptionResult | null {
  pruneExpired()
  const stored = results.get(id)
  if (!stored) return null

  if (Date.now() - stored.createdAt > RESULT_TTL_MS) {
    results.delete(id)
    return null
  }
  return stored
}
