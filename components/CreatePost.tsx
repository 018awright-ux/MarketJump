'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
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

interface TickerResult {
  symbol: string
  description: string
}

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

/**
 * Convert any image (PNG, HEIC, WEBP, etc.) to a real JPEG blob.
 * Resizes to max 1920px to avoid canvas memory limits on mobile.
 * Supabase sniffs actual file bytes, so we must produce real JPEG bytes.
 */
async function toJpeg(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      try {
        const MAX = 1920
        let { naturalWidth: w, naturalHeight: h } = img
        if (w === 0 || h === 0) throw new Error('zero dimensions')

        // Scale down large photos so canvas doesn't OOM on mobile
        if (w > MAX || h > MAX) {
          const ratio = Math.min(MAX / w, MAX / h)
          w = Math.round(w * ratio)
          h = Math.round(h * ratio)
        }

        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('no 2d context')

        ctx.drawImage(img, 0, 0, w, h)
        URL.revokeObjectURL(url)

        canvas.toBlob(
          blob => blob ? resolve(blob) : reject(new Error('toBlob returned null')),
          'image/jpeg',
          0.88
        )
      } catch (err) {
        URL.revokeObjectURL(url)
        reject(err)
      }
    }

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image failed to load')) }
    img.src = url
  })
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
  const isMP4 = file.type === 'video/mp4' || file.type === 'video/webm'

  // Short MP4/WebM — no processing needed, all browsers can play it
  if (duration <= SEGMENT_DURATION && isMP4) {
    const url = URL.createObjectURL(file)
    return [{ blob: file, url, duration, name: file.name, mediaType: 'video' }]
  }

  onProgress('Loading video processor...')
  const ff = await getFFmpeg()
  ff.on('progress', ({ progress }) => { onProgress(`Converting... ${Math.round(progress * 100)}%`) })

  // Use the real extension so FFmpeg can detect the format
  const inputExt = file.type.includes('quicktime') || file.type.includes('mov') ? 'mov' : 'mp4'
  const inputName = `input.${inputExt}`
  await ff.writeFile(inputName, await fetchFile(file))

  // Short MOV/non-MP4: just remux to MP4 container, no re-encode needed
  if (duration <= SEGMENT_DURATION) {
    const outputName = 'output.mp4'
    onProgress('Converting to MP4...')
    await ff.exec(['-i', inputName, '-c', 'copy', '-movflags', '+faststart', outputName])
    const data = await ff.readFile(outputName)
    const raw = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string)
    const copy = new Uint8Array(raw.length); copy.set(raw)
    const blob = new Blob([copy], { type: 'video/mp4' })
    const url = URL.createObjectURL(blob)
    await ff.deleteFile(inputName)
    await ff.deleteFile(outputName)
    return [{ blob, url, duration, name: file.name.replace(/\.\w+$/, '.mp4'), mediaType: 'video' }]
  }

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
  const [selectedTicker, setSelectedTicker] = useState('')   // the tagged stock (optional)
  const [tickerSearch, setTickerSearch] = useState('')       // live search query
  const [tickerResults, setTickerResults] = useState<TickerResult[]>([])
  const [searchingTicker, setSearchingTicker] = useState(false)
  const [stance, setStance] = useState<'bullish' | 'bearish' | 'neutral'>('neutral')
  const [clips, setClips] = useState<Clip[]>([])
  const [processing, setProcessing] = useState(false)
  const [processMsg, setProcessMsg] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')

  const hasText = caption.trim().length > 0
  const hasMedia = clips.length > 0
  const canPost = hasText || hasMedia   // ticker is optional
  const busy = processing || uploading
  const charsLeft = 500 - caption.length

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchTicker = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setTickerResults([]); setSearchingTicker(false); return }
    setSearchingTicker(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setTickerResults(data.results ?? [])
      } catch { setTickerResults([]) }
      setSearchingTicker(false)
    }, 350)
  }, [])

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
        setProcessMsg('Processing image...')
        // Convert to JPEG for broad browser compatibility (fixes HEIC, WEBP, etc.)
        let blob: Blob = file
        try {
          blob = await toJpeg(file)
        } catch {
          blob = file // fallback: upload original if conversion fails
        }
        const url = URL.createObjectURL(blob)
        newClips.push({ blob, url, duration: 0, name: file.name, mediaType: 'image' })
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

          // Upload file — images are pre-converted to JPEG by handleFileSelect
          const uploadBlob = clip.blob
          let contentType: string
          let ext: string

          if (isImage) {
            // clip.blob.type is 'image/jpeg' if canvas-converted, or original type if fallback
            const raw = clip.blob.type || 'image/jpeg'
            contentType = raw
            ext = raw.includes('png') ? 'png'
                : raw.includes('gif') ? 'gif'
                : raw.includes('webp') ? 'webp'
                : raw.includes('heic') ? 'heic'
                : raw.includes('heif') ? 'heif'
                : 'jpg'
          } else {
            const raw = (clip.blob as File).type || 'video/mp4'
            contentType = raw
            ext = raw.includes('quicktime') || raw.includes('mov') ? 'mov' : 'mp4'
          }

          const path = `${user.id}/${tempId}/${i}.${ext}`

          const { error: uploadError } = await supabase.storage
            .from('post-videos')
            .upload(path, uploadBlob, { contentType, upsert: false })

          if (uploadError) throw new Error(`[${contentType}] ${uploadError.message}`)

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
          ticker: selectedTicker || 'GENERAL',
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
                    <video
                      src={clip.url}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                      autoPlay
                      loop
                      preload="metadata"
                    />
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

        {/* ── TICKER TAG (optional) ── */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[#6b7280] text-[10px] font-bold uppercase tracking-wider">
              Tag a Stock <span className="normal-case text-[#4b5563] font-normal">(optional)</span>
            </div>
            {selectedTicker && (
              <button
                onClick={() => { setSelectedTicker(''); setTickerSearch(''); setTickerResults([]) }}
                className="flex items-center gap-1 text-[10px] font-bold text-[#6b7280] hover:text-white transition-colors"
              >
                <span className="text-[#C9A84C] font-black">${selectedTicker}</span>
                <span className="text-base leading-none">×</span>
              </button>
            )}
          </div>

          {/* Search input — only shown when no ticker selected */}
          {!selectedTicker && (
            <div className="relative">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(30,45,74,0.5)', border: '1px solid rgba(30,45,74,0.8)' }}>
                <svg className="w-3.5 h-3.5 text-[#4b5563] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={tickerSearch}
                  onChange={e => { setTickerSearch(e.target.value); searchTicker(e.target.value) }}
                  placeholder="Search any stock, ETF, or crypto..."
                  className="flex-1 bg-transparent text-white text-sm placeholder-[#4b5563] outline-none"
                />
                {searchingTicker && (
                  <div className="w-3.5 h-3.5 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
              </div>

              {/* Dropdown results */}
              {tickerResults.length > 0 && (
                <div
                  className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-10"
                  style={{ background: 'rgba(13,20,34,0.98)', border: '1px solid rgba(30,45,74,0.9)' }}
                >
                  {tickerResults.slice(0, 6).map(r => (
                    <button
                      key={r.symbol}
                      onClick={() => {
                        setSelectedTicker(r.symbol)
                        setTickerSearch('')
                        setTickerResults([])
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 border-b border-[#1e2d4a] last:border-0 active:bg-[#C9A84C]/10 transition-colors"
                    >
                      <span className="text-[#C9A84C] font-black text-sm">{r.symbol}</span>
                      <span className="text-[#6b7280] text-xs truncate max-w-[180px] text-right">{r.description}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* No results hint */}
              {tickerSearch.trim() && !searchingTicker && tickerResults.length === 0 && (
                <p className="text-[#4b5563] text-[10px] mt-1.5 px-1">No results — try a symbol like AAPL or SPY</p>
              )}
            </div>
          )}

          {/* Selected ticker badge */}
          {selectedTicker && (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-black"
              style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', color: '#C9A84C' }}
            >
              ${selectedTicker}
            </div>
          )}
        </div>

        {/* ── STANCE ── */}
        <div className="px-4 pb-3">
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
                {s === 'bullish' ? '🐂 Bull' : s === 'bearish' ? '🐻 Bear' : '👀 Watching'}
              </button>
            ))}
          </div>
        </div>

        {/* ── BOTTOM TOOLBAR — sticky inside scroll so it stays above the keyboard ── */}
        <div
          className="sticky bottom-0 border-t border-[#1e2d4a] px-4 flex items-center justify-between"
          style={{
            background: 'rgba(8,12,20,0.97)',
            paddingTop: '10px',
            paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
          }}
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
