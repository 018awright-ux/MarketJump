'use client'

import { useState, useRef } from 'react'
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

const SEGMENT_DURATION = 120 // 2 minutes per clip
const MAX_CLIPS = 10

const TICKERS = ['AAPL', 'NVDA', 'TSLA', 'AMZN', 'MSFT', 'META', 'GOOGL', 'AMD', 'PLTR', 'SPY', 'QQQ']

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
  ff.on('progress', ({ progress }) => { onProgress(`Splitting video... ${Math.round(progress * 100)}%`) })

  const inputName = 'input.mp4'
  await ff.writeFile(inputName, await fetchFile(file))

  const segmentCount = Math.ceil(duration / SEGMENT_DURATION)
  const clips: Clip[] = []

  for (let i = 0; i < Math.min(segmentCount, MAX_CLIPS); i++) {
    const start = i * SEGMENT_DURATION
    const outputName = `seg_${i}.mp4`
    onProgress(`Processing clip ${i + 1} of ${Math.min(segmentCount, MAX_CLIPS)}...`)

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
  const [clips, setClips] = useState<Clip[]>([])
  const [ticker, setTicker] = useState('')
  const [customTicker, setCustomTicker] = useState('')
  const [stance, setStance] = useState<'bullish' | 'bearish' | 'neutral'>('neutral')
  const [caption, setCaption] = useState('')
  const [processing, setProcessing] = useState(false)
  const [processMsg, setProcessMsg] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'media' | 'details'>('media')

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
        // Images need no processing — just wrap them
        const url = URL.createObjectURL(file)
        newClips.push({ blob: file, url, duration: 0, name: file.name, mediaType: 'image' })
        if (newClips.length >= remaining) break
      } else if (file.type.startsWith('video/')) {
        try {
          setProcessMsg(`Analyzing "${file.name}"...`)
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

  function moveClip(from: number, to: number) {
    setClips(prev => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  async function handlePost() {
    const finalTicker = (customTicker || ticker).toUpperCase().trim()
    if (!finalTicker) { setError('Please select or enter a ticker symbol.'); return }
    if (!clips.length) { setError('Add at least one photo or video.'); return }

    setError('')
    setUploading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      const tempId = crypto.randomUUID()
      const videoData: Record<string, unknown>[] = []

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

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: finalTicker, caption: caption.trim() || null, stance, videoData }),
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

  const busy = processing || uploading
  const hasMedia = clips.length > 0

  // Thumbnail for a clip
  function ClipThumb({ clip, index, showControls }: { clip: Clip; index: number; showControls?: boolean }) {
    return (
      <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-[#1e2d4a]">
        {clip.mediaType === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={clip.url} className="w-full h-full object-cover" alt={clip.name} />
        ) : (
          <video src={clip.url} className="w-full h-full object-cover" />
        )}

        {/* Order badge */}
        <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center">
          <span className="text-[#C9A84C] text-[9px] font-black">{index + 1}</span>
        </div>

        {/* Media type badge */}
        <div className="absolute top-1.5 right-7 bg-black/60 rounded-full p-0.5">
          {clip.mediaType === 'image' ? (
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2zm-10-7l2.5 3 3.5-4.5 4.5 6H5l4-4.5z" />
            </svg>
          ) : (
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </div>

        {/* Duration (videos only) */}
        {clip.mediaType === 'video' && (
          <div className="absolute bottom-1.5 left-1.5 bg-black/70 rounded-full px-1.5 py-0.5">
            <span className="text-white text-[9px] font-mono">
              {Math.floor(clip.duration / 60)}:{String(Math.floor(clip.duration % 60)).padStart(2, '0')}
            </span>
          </div>
        )}

        {showControls && (
          <>
            {index > 0 && (
              <button onClick={() => moveClip(index, index - 1)} disabled={busy}
                className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center">
                <span className="text-white text-sm">‹</span>
              </button>
            )}
            {index < clips.length - 1 && (
              <button onClick={() => moveClip(index, index + 1)} disabled={busy}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center">
                <span className="text-white text-sm">›</span>
              </button>
            )}
            <button onClick={() => removeClip(index)} disabled={busy}
              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#FF3B30]/80 flex items-center justify-center">
              <span className="text-white text-[9px] font-black">✕</span>
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(4,7,13,0.97)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 border-b border-[#1e2d4a]"
        style={{ paddingTop: 'max(20px, env(safe-area-inset-top))', paddingBottom: '16px' }}>
        <button onClick={onClose} disabled={busy} className="text-[#6b7280] text-sm font-bold disabled:opacity-40">
          Cancel
        </button>
        <h2 className="text-white font-black text-base">New Post</h2>
        <button
          onClick={step === 'media'
            ? () => { if (hasMedia && !busy) setStep('details') }
            : handlePost}
          disabled={busy || (step === 'media' && !hasMedia)}
          className="text-sm font-black px-3 py-1.5 rounded-xl transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #1B3066, #C9A84C)', color: '#fff' }}
        >
          {uploading ? `${uploadProgress}%` : step === 'media' ? 'Next' : 'Post'}
        </button>
      </div>

      {/* Step bar */}
      <div className="flex px-5 pt-3 pb-1 gap-2">
        <div className="flex-1 h-0.5 rounded-full" style={{ background: '#C9A84C' }} />
        <div className="flex-1 h-0.5 rounded-full" style={{ background: step === 'details' ? '#C9A84C' : 'rgba(30,45,74,0.8)' }} />
      </div>

      {error && (
        <div className="mx-5 mt-3 px-4 py-3 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/30">
          <p className="text-[#FF3B30] text-xs">{error}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-8">

        {/* ── STEP 1: MEDIA ─────────────────────────────────────────────── */}
        {step === 'media' && (
          <div className="px-5 pt-4">
            <p className="text-[#6b7280] text-xs mb-4">
              Add photos, videos, or mix both. Long videos auto-split into 2-min clips.
            </p>

            {/* Media type buttons */}
            {!hasMedia && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = 'image/*'
                      fileInputRef.current.click()
                    }
                  }}
                  className="flex flex-col items-center gap-3 py-8 rounded-2xl border-2 border-dashed border-[#1e2d4a] active:border-[#C9A84C]/50 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(201,168,76,0.12)', border: '1.5px solid rgba(201,168,76,0.25)' }}>
                    <svg className="w-6 h-6 text-[#C9A84C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth={2} />
                      <circle cx="8.5" cy="8.5" r="1.5" strokeWidth={2} />
                      <polyline points="21 15 16 10 5 21" strokeWidth={2} />
                    </svg>
                  </div>
                  <span className="text-white text-sm font-bold">Photo</span>
                </button>

                <button
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = 'video/*'
                      fileInputRef.current.click()
                    }
                  }}
                  className="flex flex-col items-center gap-3 py-8 rounded-2xl border-2 border-dashed border-[#1e2d4a] active:border-[#C9A84C]/50 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(201,168,76,0.12)', border: '1.5px solid rgba(201,168,76,0.25)' }}>
                    <svg className="w-6 h-6 text-[#C9A84C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <polygon points="23 7 16 12 23 17 23 7" strokeWidth={2} />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" strokeWidth={2} />
                    </svg>
                  </div>
                  <span className="text-white text-sm font-bold">Video</span>
                </button>
              </div>
            )}

            {/* Clip grid */}
            {(hasMedia || processing) && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {clips.map((clip, i) => (
                  <ClipThumb key={i} clip={clip} index={i} showControls />
                ))}

                {clips.length < MAX_CLIPS && !processing && (
                  <button
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = 'image/*,video/*'
                        fileInputRef.current.click()
                      }
                    }}
                    className="aspect-[9/16] rounded-xl border-2 border-dashed border-[#1e2d4a] flex flex-col items-center justify-center gap-2 active:border-[#C9A84C]/50"
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(201,168,76,0.15)', border: '1.5px solid rgba(201,168,76,0.3)' }}>
                      <svg className="w-5 h-5 text-[#C9A84C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <span className="text-[#6b7280] text-[10px]">Add more</span>
                  </button>
                )}

                {processing && (
                  <div className="aspect-[9/16] rounded-xl border border-[#C9A84C]/20 flex flex-col items-center justify-center gap-2"
                    style={{ background: 'rgba(201,168,76,0.05)' }}>
                    <svg className="w-7 h-7 text-[#C9A84C] animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span className="text-[#C9A84C] text-[9px] font-bold text-center px-1">{processMsg}</span>
                  </div>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

            {!hasMedia && !processing && (
              <p className="text-[#6b7280] text-[10px] text-center mt-2">
                Photos, videos, or a mix • Up to {MAX_CLIPS} items
              </p>
            )}
            {hasMedia && (
              <p className="text-[#6b7280] text-[10px] text-center">
                {clips.length} item{clips.length !== 1 ? 's' : ''} · Long videos auto-split into 2-min clips
              </p>
            )}
          </div>
        )}

        {/* ── STEP 2: DETAILS ───────────────────────────────────────────── */}
        {step === 'details' && (
          <div className="px-5 pt-5 flex flex-col gap-5">
            {/* Media strip */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {clips.map((clip, i) => (
                <div key={i} className="relative flex-none w-14 aspect-[9/16] rounded-lg overflow-hidden bg-[#1e2d4a]">
                  {clip.mediaType === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={clip.url} className="w-full h-full object-cover" alt={clip.name} />
                  ) : (
                    <video src={clip.url} className="w-full h-full object-cover" />
                  )}
                  <div className="absolute bottom-0.5 right-0.5 bg-black/70 rounded-full px-1">
                    <span className="text-[#C9A84C] text-[7px] font-black">{i + 1}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Ticker */}
            <div>
              <label className="text-[#6b7280] text-xs font-bold mb-2 block">Ticker</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {TICKERS.map(t => (
                  <button key={t} onClick={() => { setTicker(t); setCustomTicker('') }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all"
                    style={{
                      background: ticker === t && !customTicker ? 'rgba(201,168,76,0.15)' : 'rgba(8,12,20,0.6)',
                      borderColor: ticker === t && !customTicker ? 'rgba(201,168,76,0.5)' : 'rgba(30,45,74,0.8)',
                      color: ticker === t && !customTicker ? '#C9A84C' : '#6b7280',
                    }}>
                    ${t}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={customTicker}
                onChange={e => { setCustomTicker(e.target.value.toUpperCase()); setTicker('') }}
                placeholder="Or type any ticker..."
                maxLength={10}
                className="w-full px-4 py-3 rounded-xl text-white text-sm font-bold placeholder-[#6b7280] outline-none"
                style={{ background: 'rgba(30,45,74,0.5)', border: '1px solid rgba(30,45,74,0.8)' }}
              />
            </div>

            {/* Stance */}
            <div>
              <label className="text-[#6b7280] text-xs font-bold mb-2 block">Your Stance</label>
              <div className="grid grid-cols-3 gap-2">
                {(['bullish', 'neutral', 'bearish'] as const).map(s => (
                  <button key={s} onClick={() => setStance(s)}
                    className="py-3 rounded-xl border text-xs font-black transition-all"
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
                    }}>
                    {s === 'bullish' ? '🐂 Bullish' : s === 'bearish' ? '🐻 Bearish' : '⚖️ Neutral'}
                  </button>
                ))}
              </div>
            </div>

            {/* Caption */}
            <div>
              <label className="text-[#6b7280] text-xs font-bold mb-2 block">Caption</label>
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Break down your thesis..."
                rows={4}
                maxLength={500}
                className="w-full px-4 py-3 rounded-xl text-white text-sm placeholder-[#6b7280] outline-none resize-none leading-relaxed"
                style={{ background: 'rgba(30,45,74,0.5)', border: '1px solid rgba(30,45,74,0.8)' }}
              />
              <div className="text-right mt-1">
                <span className="text-[#6b7280] text-[10px]">{caption.length}/500</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upload overlay */}
      {uploading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4"
          style={{ background: 'rgba(4,7,13,0.95)' }}>
          <div className="w-24 h-24 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #1B3066, #2a4a8a)', border: '3px solid rgba(201,168,76,0.4)' }}>
            <svg className="w-10 h-10 text-[#C9A84C] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-white font-black text-lg mb-1">Uploading {uploadProgress}%</p>
            <p className="text-[#6b7280] text-sm">Don't close this screen</p>
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
