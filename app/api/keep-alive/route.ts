import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { status: 'error', message: 'Supabase env vars not set' },
        { status: 500 }
      )
    }

    // Ping the Supabase REST endpoint — a lightweight request that keeps the project alive
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    })

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      supabase_status: res.status,
    })
  } catch (err) {
    return NextResponse.json(
      { status: 'error', message: String(err), timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}
