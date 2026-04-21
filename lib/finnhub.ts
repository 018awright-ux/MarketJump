const FINNHUB_BASE = 'https://finnhub.io/api/v1'
const API_KEY = process.env.FINNHUB_API_KEY!

export async function getQuote(ticker: string) {
  const res = await fetch(
    `${FINNHUB_BASE}/quote?symbol=${ticker}&token=${API_KEY}`,
    { next: { revalidate: 30 } }
  )
  if (!res.ok) return null
  return res.json()
}

export async function getCompanyNews(ticker: string, from: string, to: string) {
  const res = await fetch(
    `${FINNHUB_BASE}/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${API_KEY}`,
    { next: { revalidate: 300 } }
  )
  if (!res.ok) return []
  return res.json()
}

export async function getMarketNews(category: 'general' | 'forex' | 'crypto' | 'merger' = 'general') {
  const res = await fetch(
    `${FINNHUB_BASE}/news?category=${category}&token=${API_KEY}`,
    { next: { revalidate: 300 } }
  )
  if (!res.ok) return []
  return res.json()
}

export async function searchSymbol(query: string) {
  const res = await fetch(
    `${FINNHUB_BASE}/search?q=${encodeURIComponent(query)}&token=${API_KEY}`,
    { next: { revalidate: 3600 } }
  )
  if (!res.ok) return { result: [] }
  return res.json()
}

// Finnhub free tier doesn't have gainers/losers directly, so we'll use a fixed list of major stocks
export const MAJOR_TICKERS = [
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'BRK.B',
  'JPM', 'V', 'UNH', 'XOM', 'LLY', 'JNJ', 'MA', 'PG', 'HD', 'MRK',
  'AVGO', 'CVX', 'ABBV', 'KO', 'AMD', 'COST', 'MCD', 'BAC', 'NFLX',
]
