'use client'

export const dynamic = 'force-dynamic'

import { useRouter } from 'next/navigation'
import CreatePost from '@/components/CreatePost'

export default function CreatePage() {
  const router = useRouter()

  function close() {
    // Opened via the header + button there's history to go back to; deep links fall back to the feed
    if (window.history.length > 1) router.back()
    else router.replace('/feed')
  }

  return (
    <CreatePost
      onClose={close}
      onPosted={() => {
        // Feed picks this up on mount and pins the new Move to the top
        try { sessionStorage.setItem('mj_feed_new_post', '1') } catch {}
        router.replace('/feed')
      }}
    />
  )
}
