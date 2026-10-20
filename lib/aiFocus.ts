'use client'

import { useSyncExternalStore } from 'react'

// What the header AI button should analyse. Screens that show a stock (the Jump Feed)
// publish their current item here; the AI drawer reads it when opened.
export interface AIFocus {
  ticker: string
  cardType?: 'stock' | 'social' | 'macro'
  headline?: string
  summary?: string
  changePercent?: number
  source?: string
}

let focus: AIFocus | null = null
const listeners = new Set<() => void>()

export function setAIFocus(next: AIFocus | null) {
  if (focus?.ticker === next?.ticker && focus?.headline === next?.headline) return
  focus = next
  listeners.forEach(l => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useAIFocus() {
  return useSyncExternalStore(subscribe, () => focus, () => null)
}
