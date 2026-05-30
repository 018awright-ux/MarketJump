import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  let isLoggedIn = false

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    isLoggedIn = !!user
  } catch {
    // Supabase unavailable — treat as logged out
    isLoggedIn = false
  }

  redirect(isLoggedIn ? '/feed' : '/login')
}
