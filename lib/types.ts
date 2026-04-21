export type UserLevel = 'rookie' | 'analyst' | 'shark'

export type Sector =
  | 'Tech'
  | 'Energy'
  | 'Healthcare'
  | 'Finance'
  | 'Crypto'
  | 'Commodities'
  | 'Real Estate'
  | 'Macro'
  | 'Options'

export type PredictionType = 'bullish' | 'bearish'
export type PredictionResult = 'correct' | 'incorrect' | 'pending'
export type CardType = 'stock' | 'social' | 'macro' | 'video'
export type SourceBadge = 'reddit' | 'stocktwits' | 'news' | 'user'
export type Stance = 'bullish' | 'bearish' | 'neutral'

export interface User {
  id: string
  username: string
  email: string
  level: UserLevel
  market_score: number
  accuracy: number
  total_predictions: number
  correct_predictions: number
  followers: number
  following: number
  interests: Sector[]
  created_at: string
}

export interface Stock {
  ticker: string
  company_name: string
  price: number
  change_percent: number
  change_amount: number
  volume: number
  sector: Sector
}

export interface Prediction {
  id: string
  user_id: string
  ticker: string
  prediction: PredictionType
  price_at_prediction: number
  created_at: string
  resolved: boolean
  resolution_date: string
  result: PredictionResult
  price_at_resolution: number | null
}

export interface JumpCard {
  id: string
  ticker: string
  company_name?: string
  headline: string
  summary: string
  source: SourceBadge
  source_name?: string
  bull_percent: number
  bear_percent: number
  card_type: CardType
  price?: number
  change_percent?: number
  created_at: string
  // Video card fields
  post?: VideoPost
}

export interface PostVideo {
  id: string
  post_id: string
  user_id: string
  storage_path: string
  public_url: string
  duration_seconds: number | null
  clip_order: number
  thumbnail_url: string | null
  created_at: string
}

export interface VideoPost {
  id: string
  user_id: string
  ticker: string
  caption: string | null
  stance: Stance
  bull_votes: number
  bear_votes: number
  view_count: number
  created_at: string
  videos: PostVideo[]
  author?: {
    username: string
    level: UserLevel
    market_score: number
  }
}

export interface Post {
  id: string
  user_id: string
  ticker: string
  content: string
  card_type: CardType
  bull_votes: number
  bear_votes: number
  created_at: string
  author?: User
}

export interface Watchlist {
  id: string
  user_id: string
  ticker: string
  added_at: string
  user_prediction_id: string | null
}

export interface LeaderboardEntry {
  rank: number
  user_id: string
  username: string
  level: UserLevel
  accuracy: number
  market_score: number
}

export interface FinnhubQuote {
  c: number
  d: number
  dp: number
  h: number
  l: number
  o: number
  pc: number
  v: number
}

export interface FinnhubNews {
  id: number
  category: string
  datetime: number
  headline: string
  image: string
  related: string
  source: string
  summary: string
  url: string
}
