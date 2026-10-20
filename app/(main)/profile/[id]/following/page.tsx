'use client'

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import FollowList from '@/components/FollowList'

function Content() {
  const { id } = useParams<{ id: string }>()
  return <FollowList profileId={id} mode="following" />
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center" style={{ background: '#080c14' }}>
        <div className="text-[#6b7280] text-sm animate-pulse">Loading...</div>
      </div>
    }>
      <Content />
    </Suspense>
  )
}
