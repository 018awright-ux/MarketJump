import Link from 'next/link'

// Tappable Audience / Following tiles — open the follower and following lists
export default function AudienceStats({ profileId, followers, following, className = '' }: {
  profileId: string
  followers: number | null | undefined
  following: number | null | undefined
  className?: string
}) {
  const tiles = [
    { href: `/profile/${profileId}/followers`, value: followers ?? 0, label: 'Audience' },
    { href: `/profile/${profileId}/following`, value: following ?? 0, label: 'Following' },
  ]
  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      {tiles.map(t => (
        <Link
          key={t.label}
          href={t.href}
          className="flex items-center justify-between rounded-xl border border-[#C9A84C]/30 px-3 py-2.5 active:scale-[0.97] transition-transform"
          style={{ background: '#12121a' }}
        >
          <div>
            <div className="text-white font-black text-lg leading-none">{t.value.toLocaleString()}</div>
            <div className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-wider mt-1">{t.label}</div>
          </div>
          <svg className="w-4 h-4 text-[#C9A84C]/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      ))}
    </div>
  )
}
