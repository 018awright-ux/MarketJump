import { NextRequest, NextResponse } from 'next/server'
import type { GoToCallerNominee } from '@/lib/awards'

export const dynamic = 'force-dynamic'

/**
 * Mock 2025 Go-To Caller nominees.
 * In production: query profiles filtered by followers >= threshold,
 * total_predictions >= 20, credibility_score > 0, ordered by follower count.
 * Limit to top 50.
 */
const MOCK_NOMINEES: GoToCallerNominee[] = [
  { id: 'n1',  username: 'techbull_pro',    brand_name: 'TechBull',      brand_avatar_url: null, level: 'guru',   followers: 5210, accuracy: 72.1, total_predictions: 341, top_call: 'Called NVDA +47% surge 6 weeks before earnings' },
  { id: 'n2',  username: 'sharktrader',     brand_name: 'SharkTrader',   brand_avatar_url: null, level: 'guru',   followers: 4120, accuracy: 69.3, total_predictions: 299, top_call: 'Shorted regional banks 3 weeks before SVB news broke' },
  { id: 'n3',  username: 'macro_maven',     brand_name: 'MacroMaven',    brand_avatar_url: null, level: 'leader', followers: 3870, accuracy: 74.2, total_predictions: 211, top_call: 'Called Fed pivot before the official pivot' },
  { id: 'n4',  username: 'optionqueen',     brand_name: 'OptionQueen',   brand_avatar_url: null, level: 'leader', followers: 3540, accuracy: 67.8, total_predictions: 487, top_call: 'TSLA puts ahead of Musk distraction selloff' },
  { id: 'n5',  username: 'the_floor_boss',  brand_name: 'FloorBoss',     brand_avatar_url: null, level: 'guru',   followers: 3290, accuracy: 70.5, total_predictions: 278, top_call: 'Energy rotation call at the exact mega-cap top' },
  { id: 'n6',  username: 'alpha_engine',    brand_name: 'AlphaEngine',   brand_avatar_url: null, level: 'leader', followers: 2980, accuracy: 65.1, total_predictions: 203, top_call: 'SMCI breakout call 3 months before the run' },
  { id: 'n7',  username: 'vol_hunter',      brand_name: 'VolHunter',     brand_avatar_url: null, level: 'shark',  followers: 2740, accuracy: 62.4, total_predictions: 561, top_call: 'VIX spike call during banking stress week' },
  { id: 'n8',  username: 'sector_seer',     brand_name: 'SectorSeer',    brand_avatar_url: null, level: 'leader', followers: 2510, accuracy: 68.0, total_predictions: 158, top_call: 'Long energy through entire Iran escalation arc' },
  { id: 'n9',  username: 'growthbull88',    brand_name: 'GrowthBull',    brand_avatar_url: null, level: 'shark',  followers: 2380, accuracy: 64.7, total_predictions: 312, top_call: 'META turnaround call when sentiment was at its worst' },
  { id: 'n10', username: 'credit_watch',    brand_name: 'CreditWatch',   brand_avatar_url: null, level: 'leader', followers: 2200, accuracy: 71.3, total_predictions: 127, top_call: 'IG spread compression before rate-cut narrative' },
  { id: 'n11', username: 'quant_fox',       brand_name: 'QuantFox',      brand_avatar_url: null, level: 'shark',  followers: 2050, accuracy: 63.2, total_predictions: 409, top_call: 'ARM IPO momentum call on day one' },
  { id: 'n12', username: 'rates_radar',     brand_name: 'RatesRadar',    brand_avatar_url: null, level: 'leader', followers: 1920, accuracy: 66.4, total_predictions: 175, top_call: '2Y yield peak call in October' },
  { id: 'n13', username: 'chip_whisperer',  brand_name: 'ChipWhisperer', brand_avatar_url: null, level: 'shark',  followers: 1810, accuracy: 61.1, total_predictions: 248, top_call: 'Semis super-cycle call when XLK was flat' },
  { id: 'n14', username: 'darkpool_dan',    brand_name: 'DarkPoolDan',   brand_avatar_url: null, level: 'leader', followers: 1690, accuracy: 59.6, total_predictions: 512, top_call: 'Unusual AMZN options flow before AWS re-rating' },
  { id: 'n15', username: 'bear_brigade',    brand_name: 'BearBrigade',   brand_avatar_url: null, level: 'shark',  followers: 1560, accuracy: 57.8, total_predictions: 634, top_call: 'Office REIT short when WFH data turned negative' },
  { id: 'n16', username: 'momentum_mitch',  brand_name: 'MomentumMitch', brand_avatar_url: null, level: 'analyst',followers: 1440, accuracy: 62.3, total_predictions: 94,  top_call: 'MSFT AI narrative before Copilot launch' },
  { id: 'n17', username: 'small_cap_sal',   brand_name: 'SmallCapSal',   brand_avatar_url: null, level: 'shark',  followers: 1380, accuracy: 60.1, total_predictions: 307, top_call: 'Microcap biotech catalyst call that tripled' },
  { id: 'n18', username: 'the_contrarian',  brand_name: 'TheContrarian', brand_avatar_url: null, level: 'leader', followers: 1310, accuracy: 58.7, total_predictions: 378, top_call: 'Faded the AI hype peak in July' },
  { id: 'n19', username: 'dividend_derek',  brand_name: 'DividendDerek', brand_avatar_url: null, level: 'analyst',followers: 1250, accuracy: 65.0, total_predictions: 83,  top_call: 'Utilities rotation call before Q4 bond rally' },
  { id: 'n20', username: 'fx_oracle',       brand_name: 'FXOracle',      brand_avatar_url: null, level: 'leader', followers: 1190, accuracy: 64.1, total_predictions: 142, top_call: 'DXY breakdown call ahead of EM rally' },
  { id: 'n21', username: 'penny_shredder',  brand_name: 'PennyShredd',   brand_avatar_url: null, level: 'shark',  followers: 1130, accuracy: 58.3, total_predictions: 589, top_call: 'Retail sentiment reversal call in December' },
  { id: 'n22', username: 'copper_king',     brand_name: 'CopperKing',    brand_avatar_url: null, level: 'analyst',followers: 1080, accuracy: 60.9, total_predictions: 117, top_call: 'Copper demand surge call ahead of EV policy shift' },
  { id: 'n23', username: 'bond_vigilante',  brand_name: 'BondVigilant',  brand_avatar_url: null, level: 'leader', followers: 1020, accuracy: 63.5, total_predictions: 196, top_call: 'TLT short when everyone was calling the bottom' },
  { id: 'n24', username: 'ai_picks',        brand_name: 'AIPicks',       brand_avatar_url: null, level: 'shark',  followers: 980,  accuracy: 59.2, total_predictions: 445, top_call: 'AI infrastructure basket before the SMCI/PLTR run' },
  { id: 'n25', username: 'reit_ranger',     brand_name: 'REITRanger',    brand_avatar_url: null, level: 'analyst',followers: 940,  accuracy: 62.7, total_predictions: 72,  top_call: 'Data center REIT rotation call in Q2' },
  { id: 'n26', username: 'crypto_clause',   brand_name: 'CryptoClaus',   brand_avatar_url: null, level: 'shark',  followers: 910,  accuracy: 57.0, total_predictions: 523, top_call: 'ETH oversold call at $1,600 in January' },
  { id: 'n27', username: 'delta_hedge',     brand_name: 'DeltaHedge',    brand_avatar_url: null, level: 'leader', followers: 880,  accuracy: 64.8, total_predictions: 163, top_call: 'VIX mean-reversion trade after August spike' },
  { id: 'n28', username: 'earnings_hawk',   brand_name: 'EarningsHawk',  brand_avatar_url: null, level: 'shark',  followers: 850,  accuracy: 61.4, total_predictions: 278, top_call: 'GOOGL earnings beat call before cloud inflection' },
  { id: 'n29', username: 'macro_mako',      brand_name: 'MacroMako',     brand_avatar_url: null, level: 'leader', followers: 820,  accuracy: 66.2, total_predictions: 137, top_call: 'Japan yen carry trade unwind signal' },
  { id: 'n30', username: 'tape_reader',     brand_name: 'TapeReader',    brand_avatar_url: null, level: 'shark',  followers: 790,  accuracy: 58.9, total_predictions: 467, top_call: 'SPY support call at every major dip in H1' },
  { id: 'n31', username: 'theta_gang',      brand_name: 'ThetaGang',     brand_avatar_url: null, level: 'analyst',followers: 760,  accuracy: 60.3, total_predictions: 89,  top_call: 'Premium collection strategy during low-vol window' },
  { id: 'n32', username: 'insider_intel',   brand_name: 'InsiderIntel',  brand_avatar_url: null, level: 'shark',  followers: 730,  accuracy: 57.6, total_predictions: 391, top_call: 'Flagged abnormal insider buying in MU before rally' },
  { id: 'n33', username: 'global_macro_g',  brand_name: 'GlobalMacroG',  brand_avatar_url: null, level: 'leader', followers: 710,  accuracy: 63.9, total_predictions: 148, top_call: 'Emerging market debt crisis warning in March' },
  { id: 'n34', username: 'fintech_fred',    brand_name: 'FintechFred',   brand_avatar_url: null, level: 'analyst',followers: 690,  accuracy: 59.4, total_predictions: 103, top_call: 'Payment network seasonal trade in Q4' },
  { id: 'n35', username: 'oil_oracle',      brand_name: 'OilOracle',     brand_avatar_url: null, level: 'shark',  followers: 670,  accuracy: 61.7, total_predictions: 213, top_call: 'WTI supply crunch call before OPEC+ cut' },
  { id: 'n36', username: 'yield_chaser',    brand_name: 'YieldChaser',   brand_avatar_url: null, level: 'analyst',followers: 650,  accuracy: 58.1, total_predictions: 96,  top_call: 'HY spread widening call before credit event' },
  { id: 'n37', username: 'biotech_beast',   brand_name: 'BiotechBeast',  brand_avatar_url: null, level: 'shark',  followers: 630,  accuracy: 56.4, total_predictions: 567, top_call: 'FDA approval cycle play on RXRX in Q3' },
  { id: 'n38', username: 'sector_rotator',  brand_name: 'SectorRotator', brand_avatar_url: null, level: 'analyst',followers: 610,  accuracy: 62.0, total_predictions: 118, top_call: 'Consumer discretionary into industrials rotation' },
  { id: 'n39', username: 'short_seller_s',  brand_name: 'ShortSellS',    brand_avatar_url: null, level: 'shark',  followers: 590,  accuracy: 55.8, total_predictions: 443, top_call: 'NYCB short before the surprise earnings miss' },
  { id: 'n40', username: 'value_vault',     brand_name: 'ValueVault',    brand_avatar_url: null, level: 'analyst',followers: 570,  accuracy: 63.1, total_predictions: 87,  top_call: 'BRK.B undervalued thesis at the February lows' },
  { id: 'n41', username: 'index_watcher',   brand_name: 'IndexWatcher',  brand_avatar_url: null, level: 'shark',  followers: 550,  accuracy: 60.6, total_predictions: 234, top_call: 'Breadth divergence warning before May correction' },
  { id: 'n42', username: 'gold_digger_g',   brand_name: 'GoldDiggerG',   brand_avatar_url: null, level: 'analyst',followers: 530,  accuracy: 61.8, total_predictions: 109, top_call: 'Gold breakout above $2,100 before ATH run' },
  { id: 'n43', username: 'supply_chain_s',  brand_name: 'SupplyChainS',  brand_avatar_url: null, level: 'analyst',followers: 510,  accuracy: 59.9, total_predictions: 97,  top_call: 'Inventory glut reversal call in semis' },
  { id: 'n44', username: 'vol_surface',     brand_name: 'VolSurface',    brand_avatar_url: null, level: 'shark',  followers: 490,  accuracy: 58.2, total_predictions: 378, top_call: 'Skew trade on SPX before election volatility' },
  { id: 'n45', username: 'carbon_caller',   brand_name: 'CarbonCaller',  brand_avatar_url: null, level: 'analyst',followers: 470,  accuracy: 60.7, total_predictions: 82,  top_call: 'Clean energy rotation call at the sector lows' },
  { id: 'n46', username: 'rate_watcher',    brand_name: 'RateWatcher',   brand_avatar_url: null, level: 'analyst',followers: 460,  accuracy: 57.3, total_predictions: 134, top_call: 'Called the second Fed hold before the pause' },
  { id: 'n47', username: 'china_trade',     brand_name: 'ChinaTrade',    brand_avatar_url: null, level: 'shark',  followers: 440,  accuracy: 56.9, total_predictions: 289, top_call: 'FXI recovery call after reopening confirmation' },
  { id: 'n48', username: 'dividend_dude',   brand_name: 'DividendDude',  brand_avatar_url: null, level: 'analyst',followers: 420,  accuracy: 62.4, total_predictions: 74,  top_call: 'Preferred equity value call before rate pivot' },
  { id: 'n49', username: 'flow_follower',   brand_name: 'FlowFollower',  brand_avatar_url: null, level: 'shark',  followers: 410,  accuracy: 57.8, total_predictions: 312, top_call: 'Market-on-close imbalance pattern in FOMC week' },
  { id: 'n50', username: 'the_setup',       brand_name: 'TheSetup',      brand_avatar_url: null, level: 'analyst',followers: 400,  accuracy: 60.1, total_predictions: 101, top_call: 'Flag pattern breakout call on AMD before GPU rally' },
]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = (searchParams.get('q') ?? '').toLowerCase().trim()

  const filtered = search
    ? MOCK_NOMINEES.filter(n =>
        (n.brand_name ?? n.username).toLowerCase().includes(search) ||
        n.username.toLowerCase().includes(search)
      )
    : MOCK_NOMINEES

  return NextResponse.json({ nominees: filtered })
}
