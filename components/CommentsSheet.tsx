'use client'

import { useState, useEffect, useRef } from 'react'

interface Comment {
  id: string
  body: string
  created_at: string
  profiles: { username: string; level: string } | null
}

interface CommentsSheetProps {
  postId?: string
  cardId?: string
  articleUrl?: string
  title?: string
  onClose: () => void
  onCommentPosted?: () => void
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function CommentsSheet({ postId, cardId, articleUrl, title, onClose, onCommentPosted }: CommentsSheetProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadComments()
    // Focus input immediately so keyboard opens
    const timer = setTimeout(() => inputRef.current?.focus(), 300)
    return () => clearTimeout(timer)
  }, [postId, cardId, articleUrl])

  async function loadComments() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (postId) params.set('post_id', postId)
      else if (cardId) params.set('card_id', cardId)
      else if (articleUrl) params.set('article_url', articleUrl ?? '')
      const res = await fetch(`/api/comments?${params}`)
      const data = await res.json()
      setComments(data.comments ?? [])
    } catch {}
    setLoading(false)
  }

  async function submitComment() {
    if (!body.trim() || posting) return
    setPosting(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, card_id: cardId, article_url: articleUrl, body }),
      })
      if (res.ok) {
        const data = await res.json()
        setComments(prev => [...prev, data.comment])
        setBody('')
        onCommentPosted?.()
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    } catch {}
    setPosting(false)
  }

  return (
    <div className="fixed inset-0 z-[250] flex flex-col items-center justify-end" onClick={onClose}>
      <div
        className="w-full max-w-lg flex flex-col rounded-t-3xl overflow-hidden"
        style={{ background: '#0d1422', border: '1px solid rgba(201,168,76,0.15)', borderBottom: 'none', maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex-shrink-0 pt-3 pb-2 flex flex-col items-center border-b border-[#1e2d4a]">
          <div className="w-10 h-1 rounded-full bg-[#2a2a3a] mb-3" />
          <div className="flex items-center justify-between w-full px-5 pb-1">
            <h3 className="text-white font-black text-base">
              {comments.length > 0 ? `${comments.length} Comment${comments.length !== 1 ? 's' : ''}` : 'Comments'}
            </h3>
            {title && <span className="text-[#6b7280] text-xs truncate max-w-[160px]">{title}</span>}
          </div>
        </div>

        {/* Comment list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-3xl mb-2">💬</div>
              <p className="text-[#6b7280] text-sm">No comments yet. Be the first!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-black"
                    style={{ background: 'linear-gradient(135deg, #1B3066, #C9A84C)', color: '#fff' }}
                  >
                    {(c.profiles?.username ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-white text-xs font-bold">{c.profiles?.username ?? 'Anonymous'}</span>
                      <span className="text-[#4b5563] text-[10px]">{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="text-[#d1d5db] text-sm leading-relaxed">{c.body}</p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input bar */}
        <div
          className="flex-shrink-0 border-t border-[#1e2d4a] px-4 py-3 flex gap-2 items-end"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <textarea
            ref={inputRef}
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }}
            placeholder="Add a comment..."
            maxLength={300}
            rows={1}
            className="flex-1 bg-transparent text-white text-sm placeholder-[#4b5563] outline-none resize-none leading-relaxed rounded-xl px-3 py-2"
            style={{ background: 'rgba(30,45,74,0.4)', border: '1px solid rgba(30,45,74,0.8)', minHeight: '38px', maxHeight: '100px' }}
          />
          <button
            onClick={submitComment}
            disabled={!body.trim() || posting}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-30 active:scale-90"
            style={{ background: 'linear-gradient(135deg, #1B3066, #C9A84C)' }}
          >
            {posting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
