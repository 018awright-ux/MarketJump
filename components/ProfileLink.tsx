'use client'

import Link from 'next/link'

// Link to a user's profile that doesn't also trigger the tappable card/row it sits in
export default function ProfileLink({ userId, className = '', children }: {
  userId: string | null | undefined
  className?: string
  children: React.ReactNode
}) {
  if (!userId) return <span className={className}>{children}</span>
  return (
    <Link
      href={`/profile/${userId}`}
      onClick={e => e.stopPropagation()}
      className={`active:opacity-70 ${className}`}
    >
      {children}
    </Link>
  )
}
