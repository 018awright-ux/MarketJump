'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

type MediaType = 'video' | 'image'

interface Clip {
  blob: Blob
  url: string
  duration: number
  name: string
  mediaType: MediaType
}

interface CreatePostProps {
  onClose: () => void
  onPosted: () => void
}

const SEGMENT_DURATION = 120
const MAX_CLIPS = 10

const TICKERS = ['AAPL', 'NVDA', 'TSLA', 'AMZN', 'MSFT', 'META', 'GOOGL', 'AMD', 'PLTR', 'SPY', 'QQQ', 'BTC-USD', 'ETH-USD']

let ffmpegInstance: FFmpeg | null = null

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance
  const ff = new FFmpeg()
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
  await ff.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })
  ffmpegInstance = ff
  return ff
}

async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = URL.createObjectURL(file)
    video.onloadedmetadata = () => { URL.revokeObjectURL(video.src); resolve(video.duration) }
    video.onerror = () => resolve(0)
  })
}

async function splitVideo(file: File, onProgress: (msg: string) => void): Promise<Clip[]> {
  const duration = await getVideoDuration(file)
  if (duration <= SEGMENT_DURATION) {
    const url = URL.createObjectURL(file)
    return [{ blob: file, url, duration, name: file.name, mediaType: 'video' }]
  }

  onProgress('Loading video processor...')
  const ff = await getFFmpeg()
  ff.on('progress', ({ progress }) => { onProgress(`Splitting... ${Math.round(progress * 100)}%`) })

  const inputName = 'input.mp4'
  await ff.writeFile(inputName, await fetchFile(file))

  const segmentCount = Math.ceil(duration / SEGMENT_DURATION)
  const clips: Clip[] = []

  for (let i = 0; i < Math.min(segmentCount, MAX_CLIPS); i++) {
    const start = i * SEGMENT_DURATION
    const outputName = `seg_${i}.mp4`
    onProgress(`Clip ${i + 1} of ${Math.min(segmentCount, MAX_CLIPS)}...`)

    await ff.exec(['-i', inputName, '-ss', String(start), '-t', String(SEGMENT_DURATION),
      '-c', 'copy', '-avoid_negative_ts', 'make_zero', outputName])

    const data = await ff.readFile(outputName)
    const raw = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string)
    const copy = new Uint8Array(raw.length)
    copy.set(raw)
    const blob = new Blob([copy], { type: 'video/mp4' })
    const url = URL.createObjectURL(blob)
    clips.push({ blob, url, duration: Math.min(SEGMENT_DURATION, duration - start), name: `clip_${i + 1}.mp4`, mediaType: 'video' })
    await ff.deleteFile(outputName)
  }

  await ff.deleteFile(inputName)
  return clips
}

export default function CreatePost({ onClose, onPosted }: CreatePostProps) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [caption, setCaption] = useState('')
  const [ticker, setTicker] = useState('')
  const [customTicker, setCustomTicker] = useState('')
  const [stance, setStance] = useState<'bullish' | 'bearish' | 'neutral'>('neutral')
  const [clips, setClips] = useState<Clip[]>([])
  const [processing, setProcessing] = useState(false)
  const [processMsg, setProcessMsg] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [showTickerInput, setShowTickerInput] = useState(false)

  const finalTicker = (customTicker || ticker).toUpperCase().trim()
  const hasText = caption.trim().length > 0
  const hasMedia = clips.length > 0
  const canPost = (hasText || hasMedia) && !!finalTicker
  const busy = processing || uploading
  const charsLeft = 500 - caption.length

  useEffect(() => {
    // Auto-focus text area on open
    setTimeout(() => textareaRef.current?.focus(), 100)
  }, [])

  // Auto-grow textarea
  function handleCaptionChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setCaption(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    e.target.value = ''
    setError('')

    const remaining = MAX_CLIPS - clips.length
    if (remaining <= 0) return

    setProcessing(true)
    const newClips: Clip[] = []

    for (const file of files.slice(0, remaining)) {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file)
        newClips.push({ blob: file, url, duration: 0, name: file.name, mediaType: 'image' })
        if (newClips.length >= remaining) break
      } else if (file.type.startsWith('video/')) {
        try {
          setProcessMsg(`Processing "${file.name}"...`)
          const segments = await splitVideo(file, setProcessMsg)
          const canAdd = remaining - newClips.length
          newClips.push(...segments.slice(0, canAdd))
          if (newClips.length >= remaining) break
        } catch (err) {
          console.error(err)
          setError(`Failed to process "${file.name}". Try a different format.`)
        }
      }
    }

    setClips(prev => [...prev, ...newClips])
    setProcessing(false)
    setProcessMsg('')
  }

  function removeClip(index: number) {
    setClips(prev => {
      URL.revokeObjectURL(prev[index].url)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function handlePost() {
    if (!canPost || busy) return
    if (!finalTicker) { setError('Select a ticker symbol.'); return }
    if (!hasText && !hasMedia) { setError('Write something or add a photo/video.'); return }

    setError('')
    setUploading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      const videoData: Record<string, unknown>[] = []

      if (hasMedia) {
        const tempId = crypto.randomUUID()
        for (let i = 0; i < clips.length; i++) {
          const clip = clips[i]
          const isImage = clip.mediaType === 'image'
          const ext = isImage ? (clip.name.split('.').pop()?.toLowerCase() ?? 'jpg') : 'mp4'
          const path = `${user.id}/${tempId}/${i}.${ext}`
          const contentType = isImage ? (clip.blob.type || 'image/jpeg') : 'video/mp4'

          const { error: uploadError } = await supabase.storage
            .from('post-videos')
            .upload(path, clip.blob, { contentType, upsert: false })

          if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

          const { data: urlData } = supabase.storage.from('post-videos').getPublicUrl(path)

          videoData.push({
            storage_path: path,
            public_url: urlData.publicUrl,
            duration_seconds: clip.duration,
            clip_order: i,
            media_type: clip.mediaType,
          })

          setUploadProgress(Math.round(((i + 1) / clips.length) * 100))
        }
      }

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: finalTicker,
          caption: caption.trim() || null,
          stance,
          videoData: videoData.length ? videoData : undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to post')
      }

      clips.forEach(c => URL.revokeObjectURL(c.url))
      onPosted()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setUploading(false)
      setUploadProgress(0)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: '#080c14' }}>

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 border-b border-[#1e2d4a]"
        style={{ paddingTop: 'max(20px, env(safe-area-inset-top))', paddingBottom: '14px' }}
      >
        <button onClick={onClose} disabled={busy} className="text-[#6b7280] text-sm font-bold disabled:opacity-40">
          Cancel
        </button>
        <h2 className="text-white font-black text-base">New Post</h2>
        <button
          onClick={handlePost}
          disabled={!canPost || busy}
          className="text-sm font-black px-4 py-1.5 rounded-xl transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #1B3066, #C9A84C)', color: '#fff' }}
        >
          {uploading ? `${uploadProgress}%` : 'Post'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 px-4 py-2.5 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/30">
          <p className="text-[#FF3B30] text-xs">{error}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">

        {/* ── COMPOSE AREA ── */}
        <div className="px-4 pt-4 pb-2">
          <textarea
            ref={textareaRef}
            value={caption}
            onChange={handleCaptionChange}
            placeholder="What's your market take?"
            maxLength={500}
            rows={4}
            className="w-full bg-transparent text-white text-base placeholder-[#4b5563] outline-none resize-none leading-relaxed"
            style={{ minHeight: '120px' }}
          />
        </div>

        {/* ── MEDIA PREVIEWS ── */}
        {(hasMedia || processing) && (
          <div className="px-4 pb-3">
            <div className={`grid gap-2 ${clips.length === 1 ? 'grid-cols-1' : clips.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {clips.map((clip, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden bg-[#1e2d4a]"
                  style={{ aspectRatio: clips.length === 1 ? '16/9' : '1/1' }}>
                  {clip.mediaType === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={clip.url} className="w-full h-full object-cover" alt={clip.name} />
                  ) : (
                    <video src={clip.url} className="w-full h-full object-cover" />
                  )}
                  {clip.mediaType === 'video' && (
                    <div className="absolute bottom-1.5 left-1.5 bg-black/70 rounded-full px-1.5 py-0.5">
                      <span className="text-white text-[9px] font-mono">
                        {Math.floor(clip.duration / 60)}:{String(Math.floor(clip.duration % 60)).padStart(2, '0')}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => removeClip(i)}
                    disabled={busy}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center"
                  >
                    <span className="text-white text-xs font-black">✕</span>
                  </button>
                </div>
              ))}
              {processing && (
                <div className="rounded-xl border border-[#C9A84C]/20 flex flex-col items-center justify-center gap-2 p-4"
                  style={{ background: 'rgba(201,168,76,0.05)', aspectRatio: '1/1' }}>
                  <svg className="w-6 h-6 text-[#C9A84C] animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span className="text-[#C9A84C] text-[9px] font-bold text-center">{processMsg}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="mx-4 border-t border-[#1e2d4a]" />

        {/* ── TICKER SELECTOR ── */}
        <div className="px-4 pt-4 pb-3">
          <div className="text-[#6b7280] text-[10px] font-bold uppercase tracking-wider mb-2">Ticker *</div>

          {/* Quick chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {TICKERS.map(t => (
              <button
                key={t}
                onClick={() => { setTicker(t); setCustomTicker(''); setShowTickerInput(false) }}
                className="flex-none px-3 py-1.5 rounded-xl text-xs font-bold border transition-all"
                style={{
                  background: ticker === t && !customTicker ? 'rgba(201,168,76,0.15)' : 'rgba(13,20,34,0.8)',
                  borderColor: ticker === t && !customTicker ? 'rgba(201,168,76,0.5)' : 'rgba(30,45,74,0.8)',
                  color: ticker === t && !customTicker ? '#C9A84C' : '#6b7280',
                  whiteSpace: 'nowrap',
                }}
              >
                ${t}
              </button>
            ))}
            <button
              onClick={() => setShowTickerInput(v => !v)}
              className="flex-none px-3 py-1.5 rounded-xl text-xs font-bold border transition-all"
              style={{
                background: showTickerInput || customTicker ? 'rgba(201,168,76,0.15)' : 'rgba(13,20,34,0.8)',
                borderColor: showTickerInput || customTicker ? 'rgba(201,168,76,0.5)' : 'rgba(30,45,74,0.8)',
                color: showTickerInput || customTicker ? '#C9A84C' : '#6b7280',
              }}
            >
              {customTicker ? `$${customTicker}` : '+ Other'}
            </button>
          </div>

          {showTickerInput && (
            <input
              type="text"
              value={customTicker}
              onChange={e => { setCustomTicker(e.target.value.toUpperCase()); setTicker('') }}
              placeholder="Type ticker (e.g. NVDA)"
              maxLength={10}
              autoFocus
              className="w-full mt-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold placeholder-[#6b7280] outline-none"
              style={{ background: 'rgba(30,45,74,0.5)', border: '1px solid rgba(201,168,76,0.3)' }}
            />
          )}
        </div>

        {/* ── STANCE ── */}
        <div className="px-4 pb-5">
          <div className="text-[#6b7280] text-[10px] font-bold uppercase tracking-wider mb-2">Your Stance</div>
          <div className="grid grid-cols-3 gap-2">
            {(['bullish', 'neutral', 'bearish'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStance(s)}
                className="py-2.5 rounded-xl border text-xs font-black transition-all"
                style={{
                  background: stance === s
                    ? s === 'bullish' ? 'rgba(0,200,5,0.15)' : s === 'bearish' ? 'rgba(255,59,48,0.15)' : 'rgba(201,168,76,0.1)'
                    : 'rgba(8,12,20,0.6)',
                  borderColor: stance === s
                    ? s === 'bullish' ? 'rgba(0,200,5,0.5)' : s === 'bearish' ? 'rgba(255,59,48,0.5)' : 'rgba(201,168,76,0.4)'
                    : 'rgba(30,45,74,0.8)',
                  color: stance === s
                    ? s === 'bullish' ? '#00C805' : s === 'bearish' ? '#FF3B30' : '#C9A84C'
                    : '#6b7280',
                }}
              >
                {s === 'bullish' ? '🐂 Bull' : s === 'bearish' ? '🐻 Bear' : '⚖️ Neutral'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── BOTTOM TOOLBAR ── */}
      <div
        className="border-t border-[#1e2d4a] px-4 py-3 flex items-center justify-between"
        style={{ background: 'rgba(8,12,20,0.97)', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        {/* Media buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = 'image/*'
                fileInputRef.current.multiple = true
                fileInputRef.current.click()
              }
            }}
            disabled={busy || clips.length >= MAX_CLIPS}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors disabled:opacity-30"
            style={{ color: '#6b7280' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
              <circle cx="8.5" cy="8.5" r="1.5" strokeWidth={2} />
              <polyline points="21 15 16 10 5 21" strokeWidth={2} />
            </svg>
          </button>

          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = 'video/*'
                fileInputRef.current.multiple = false
                fileInputRef.current.click()
              }
            }}
            disabled={busy || clips.length >= MAX_CLIPS}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors disabled:opacity-30"
            style={{ color: '#6b7280' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <polygon points="23 7 16 12 23 17 23 7" strokeWidth={2} />
              <rect x="1" y="5" width="15" height="14" rx="2" strokeWidth={2} />
            </svg>
          </button>
        </div>

        {/* Char counter */}
        <span
          className="text-xs font-mono font-bold tabular-nums"
          style={{ color: charsLeft < 50 ? (charsLeft < 20 ? '#FF3B30' : '#C9A84C') : '#4b5563' }}
        >
          {charsLeft}
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Upload overlay */}
      {uploading && (
        <div className="absolute inset-0 z-[210] flex flex-col items-center justify-center gap-4"
          style={{ background: 'rgba(4,7,13,0.95)' }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #1B3066, #2a4a8a)', border: '3px solid rgba(201,168,76,0.4)' }}>
            <svg className="w-8 h-8 text-[#C9A84C] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-white font-black text-lg mb-1">Uploading {uploadProgress}%</p>
            <p className="text-[#6b7280] text-sm">Don&apos;t close this screen</p>
          </div>
          <div className="w-48 h-1.5 rounded-full bg-[#1e2d4a] overflow-hidden">
            <div className="h-full bg-[#C9A84C] rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}
