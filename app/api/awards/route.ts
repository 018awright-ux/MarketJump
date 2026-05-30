import { NextRequest, NextResponse } from 'next/server'
import { getAwardsStatus, type GoToCallerResult } from '@/lib/awards'

export const dynamic = 'force-dynamic'

/** Mock 2024 Go-To Caller results — replace with Supabase query once tables exist */
const MOCK_2024_RESULTS: GoToCallerResult = {
  year: 2024,
  first_team: [
    { id: '1', username: 'techbull_pro',    brand_name: 'TechBull',      brand_avatar_url: null, level: 'guru',   followers: 4820, accuracy: 71.4, total_predictions: 312, top_call: 'Called NVDA +47% surge 6 weeks before earnings' },
    { id: '2', username: 'sharktrader',     brand_name: 'SharkTrader',   brand_avatar_url: null, level: 'guru',   followers: 3950, accuracy: 68.9, total_predictions: 278, top_call: 'Shorted SVB 3 weeks before collapse' },
    { id: '3', username: 'macro_maven',     brand_name: 'MacroMaven',    brand_avatar_url: null, level: 'leader', followers: 3210, accuracy: 73.1, total_predictions: 195, top_call: 'Called Fed pivot before the November pivot' },
    { id: '4', username: 'optionqueen',     brand_name: 'OptionQueen',   brand_avatar_url: null, level: 'leader', followers: 2880, accuracy: 66.2, total_predictions: 441, top_call: 'TSLA puts ahead of Musk Twitter distraction selloff' },
    { id: '5', username: 'the_floor_boss',  brand_name: 'FloorBoss',     brand_avatar_url: null, level: 'guru',   followers: 2750, accuracy: 69.7, total_predictions: 267, top_call: 'Rotated out of mega-cap tech into energy at the top' },
  ],
  second_team: [
    { id: '6',  username: 'alpha_engine',   brand_name: 'AlphaEngine',   brand_avatar_url: null, level: 'leader', followers: 2340, accuracy: 64.5, total_predictions: 189, top_call: 'Spotted SMCI breakout 3 months early' },
    { id: '7',  username: 'vol_hunter',     brand_name: 'VolHunter',     brand_avatar_url: null, level: 'shark',  followers: 2180, accuracy: 61.8, total_predictions: 523, top_call: 'Called VIX spike during banking crisis week' },
    { id: '8',  username: 'sector_seer',    brand_name: 'SectorSeer',    brand_avatar_url: null, level: 'leader', followers: 1960, accuracy: 67.3, total_predictions: 142, top_call: 'Long energy sector through entire Iran escalation' },
    { id: '9',  username: 'growthbull88',   brand_name: 'GrowthBull',    brand_avatar_url: null, level: 'shark',  followers: 1820, accuracy: 63.9, total_predictions: 298, top_call: 'META turnaround call when sentiment was at worst' },
    { id: '10', username: 'credit_watch',   brand_name: 'CreditWatch',   brand_avatar_url: null, level: 'leader', followers: 1690, accuracy: 70.2, total_predictions: 113, top_call: 'IG spread compression trade before rate-cut narrative' },
  ],
  callers: [
    { id: '11', username: 'quant_fox',      brand_name: 'QuantFox',      brand_avatar_url: null, level: 'shark',  followers: 1540, accuracy: 62.1, total_predictions: 387, top_call: 'ARM IPO momentum call day one' },
    { id: '12', username: 'rates_radar',    brand_name: 'RatesRadar',    brand_avatar_url: null, level: 'leader', followers: 1430, accuracy: 65.8, total_predictions: 161, top_call: '2Y yield peak call in October 2023' },
    { id: '13', username: 'chip_whisperer', brand_name: 'ChipWhisperer', brand_avatar_url: null, level: 'shark',  followers: 1320, accuracy: 60.4, total_predictions: 234, top_call: 'Semis super-cycle call when XLK was flat' },
    { id: '14', username: 'darkpool_dan',   brand_name: 'DarkPoolDan',   brand_avatar_url: null, level: 'leader', followers: 1210, accuracy: 58.9, total_predictions: 478, top_call: 'Spotted unusual AMZN options flow before AWS re-rating' },
    { id: '15', username: 'bear_brigade',   brand_name: 'BearBrigade',   brand_avatar_url: null, level: 'shark',  followers: 1180, accuracy: 56.3, total_predictions: 612, top_call: 'Office REIT short thesis when WFH data turned' },
    { id: '16', username: 'momentum_mitch', brand_name: 'MomentumMitch', brand_avatar_url: null, level: 'analyst',followers: 1090, accuracy: 61.0, total_predictions: 89,  top_call: 'MSFT AI narrative call before Copilot launch' },
    { id: '17', username: 'small_cap_sal',  brand_name: 'SmallCapSal',   brand_avatar_url: null, level: 'shark',  followers: 980,  accuracy: 59.7, total_predictions: 291, top_call: 'Microcap biotech catalyst that 3xed' },
    { id: '18', username: 'the_contrarian', brand_name: 'TheContrarian', brand_avatar_url: null, level: 'leader', followers: 930,  accuracy: 57.4, total_predictions: 345, top_call: 'Faded the AI hype peak in July correctly' },
    { id: '19', username: 'dividend_derek', brand_name: 'DividendDerek', brand_avatar_url: null, level: 'analyst',followers: 880,  accuracy: 64.2, total_predictions: 76,  top_call: 'Utilities defensive rotation call before Q4 bonds rally' },
    { id: '20', username: 'fx_oracle',      brand_name: 'FXOracle',      brand_avatar_url: null, level: 'leader', followers: 820,  accuracy: 63.6, total_predictions: 128, top_call: 'DXY breakdown call that front-ran EM rally' },
  ],
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  if (type === 'goto-caller-results') {
    return NextResponse.json({
      status: getAwardsStatus(),
      results: [MOCK_2024_RESULTS],
    })
  }

  return NextResponse.json({
    status: getAwardsStatus(),
    year: new Date().getFullYear(),
  })
}
