-- MarketJump — Jump Cards Seed
-- Run in Supabase SQL Editor → "Run without RLS"
-- Inserts real-looking cards regardless of existing data

insert into public.jump_cards (ticker, company_name, headline, summary, source, source_name, bull_percent, bear_percent, card_type, price, change_percent) values

-- AAPL
('AAPL','Apple Inc.','Apple Vision Pro demand surges after enterprise partnerships announced','Apple reported a 340% quarter-over-quarter increase in Vision Pro orders following deals with Fortune 500 enterprises. Analysts are revising price targets upward on spatial computing momentum. Goldman Sachs raised their target to $240.','news','Bloomberg',68,32,'stock',213.49,2.14),
('AAPL','Apple Inc.','r/stocks: Apple Services is the most underrated moat in the S&P 500','People keep obsessing over iPhone units. The real story is $100B+ annual services revenue growing 15% YoY at 75% gross margins. App Store, iCloud, Apple Pay — every product funnels into recurring revenue. This thing is a cash machine.','reddit','u/CompounderKing',65,35,'social',213.49,2.14),
('AAPL','Apple Inc.','Apple AI features drive record iPhone upgrade cycle — analysts see supercycle forming','Apple Intelligence features exclusive to iPhone 16 are driving the highest upgrade rates since iPhone 6. Morgan Stanley estimates 250M installed base eligible for upgrade. Services attach rate per device climbing.','news','Morgan Stanley',72,28,'stock',213.49,2.14),

-- NVDA
('NVDA','NVIDIA Corporation','NVIDIA Blackwell GPU backlog extends to 18 months amid AI infrastructure buildout','Hyperscalers are locked in an arms race for compute. NVDA Blackwell architecture is the only game in town for frontier AI training runs. Supply constraints keeping margins at 75%+ gross. No credible competitor within 2 years.','news','Reuters',74,26,'stock',875.43,3.67),
('NVDA','NVIDIA Corporation','r/wallstreetbets: NVDA $1200 by end of year or I eat my GPU','DD: Every single AI company is buying Blackwell. Microsoft, Google, Meta, Amazon all confirmed orders. Blackwell backlog = 18 months of guaranteed revenue. Bears have been wrong for 3 years straight.','reddit','u/DeepValueHunter99',81,19,'social',875.43,3.67),
('NVDA','NVIDIA Corporation','NVIDIA announces NIM microservices — enterprise AI deployment just got 10x easier','NVIDIA Inference Microservices let companies deploy AI models in hours instead of months. 200+ enterprise customers in beta. This is the software layer that locks in the hardware moat long-term.','news','TechCrunch',77,23,'stock',875.43,3.67),

-- TSLA
('TSLA','Tesla Inc.','Tesla FSD v13 achieves 99.2% intervention-free miles in California trials','Tesla Full Self-Driving software hit a new milestone in regulatory testing. Robotaxi launch timeline moved to Q3. Bears pointing to ongoing margin compression in core EV business while bulls focus on autonomous revenue potential.','news','TechCrunch',52,48,'stock',248.73,-1.23),
('TSLA','Tesla Inc.','StockTwits: TSLA is a robotics company now, stop valuing it like a car company','The market is still pricing TSLA like a 2-3% margin auto manufacturer. Optimus humanoid robot entering mass production at $20K/unit cost. FSD miles ahead of Waymo on consumer scale. This is a $2T company in 3 years.','stocktwits','@TeslaMaximalist',59,41,'social',248.73,-1.23),
('TSLA','Tesla Inc.','Tesla Q1 deliveries miss estimates by 8% — price cuts fail to stimulate demand','Tesla delivered 386K vehicles in Q1, missing consensus of 421K. Fourth consecutive quarter of YoY delivery declines. Management blaming factory upgrades and Red Sea shipping disruptions. Margin guidance cut again.','news','WSJ',34,66,'stock',248.73,-1.23),

-- AMZN
('AMZN','Amazon.com Inc.','AWS revenue accelerates to 21% YoY growth as enterprise AI adoption spikes','Amazon Web Services posted its fastest growth in two years. Bedrock AI platform seeing 10x customer adoption quarter-over-quarter. Retail operating margins hit all-time high of 6.4% as logistics automation matures.','news','WSJ',71,29,'stock',198.12,1.87),
('AMZN','Amazon.com Inc.','Amazon same-day delivery now covers 50% of US population — logistics moat widens','Amazon expanded same-day delivery to 30 new metro areas. 3P seller growth accelerating as logistics cost advantage becomes insurmountable for competitors. Advertising revenue growing 27% YoY.','news','Bloomberg',69,31,'stock',198.12,1.87),

-- META
('META','Meta Platforms Inc.','Meta AI hits 500M monthly active users — Zuckerberg calls it fastest growing AI assistant ever','Meta AI integrated across WhatsApp, Instagram, and Facebook now serves 500M MAU. Llama 4 outperforms GPT-4 on key benchmarks at fraction of inference cost. Ad targeting improvements driving 22% revenue growth.','news','Reuters',76,24,'stock',512.87,2.93),
('META','Meta Platforms Inc.','r/investing: Meta is the most undervalued Mag-7 stock right now','Trading at 22x forward earnings vs peers at 30x+. Reality Labs losses finally shrinking. AI ad targeting = structural revenue advantage. $50B buyback program. Zuckerberg owns 13% and is buying more. No-brainer.','reddit','u/ValueInvestorPro',73,27,'social',512.87,2.93),

-- MSFT
('MSFT','Microsoft Corporation','Microsoft Copilot adoption reaches 1M enterprise seats — monetization accelerating','Microsoft 365 Copilot now deployed across 1M enterprise seats at $30/user/month. Azure OpenAI API calls up 400% YoY. GitHub Copilot paying users hit 2M. AI premium is flowing directly to operating income.','news','Bloomberg',78,22,'stock',415.32,1.54),
('MSFT','Microsoft Corporation','Azure cloud growth reaccelerates to 29% — beats AWS for first time in AI workloads','Microsoft Azure posted 29% growth driven by AI infrastructure demand. For the first time, Azure is winning more AI workloads than AWS according to Gartner survey. OpenAI exclusivity proving to be a $100B+ strategic bet.','news','Reuters',74,26,'stock',415.32,1.54),

-- AMD
('AMD','Advanced Micro Devices','AMD MI300X GPU sells out through 2025 — NVDA alternative finally here','AMD MI300X GPU accelerators are sold out through end of 2025 with Microsoft, Meta and Oracle all placing large orders. Inferencing workloads where AMD is most competitive. NVDA alternative narrative gaining traction.','news','Wired',61,39,'stock',178.54,4.21),
('AMD','Advanced Micro Devices','StockTwits: AMD is the 2nd place AI chip play and 2nd place is worth $500B','NVDA cant supply everyone. AMD MI300X is good enough for inference. Meta using it. Microsoft using it. At 35x earnings vs NVDA at 65x, AMD is the value play in AI chips. $250 target.','stocktwits','@SemiconductorSam',58,42,'social',178.54,4.21),

-- SPY / Macro
('SPY',null,'Fed holds rates at 4.25-4.50%, signals two cuts in 2025 — Powell: Data dependent','The Federal Reserve held rates steady at their May meeting. Dot plot maintained at two 25bp cuts in 2025. Powell emphasized data dependency. Markets pricing 68% probability of September cut. Bonds rallying.','news','Federal Reserve',61,39,'macro',null,null),
('OIL',null,'OPEC+ extends production cuts through Q3 — Brent crude spikes 4% to $89/bbl','Saudi Arabia and Russia agreed to extend voluntary production cuts of 2.2M barrels/day through September. Energy sector rallying hard. XOM, CVX, OXY all up 3%+. Consumer spending headwind building.','news','Reuters',44,56,'macro',null,null),
('GEO',null,'US-China trade tensions escalate: new tariffs on EVs, semiconductors, and solar panels','New legislation proposes 60% tariffs on Chinese EVs, 50% on semiconductors, 100% on solar panels. US chip makers (NVDA, AMD, QCOM) benefit from reduced competition. Consumer electronics face cost headwinds. Supply chains in flux.','news','Reuters',38,62,'macro',null,null),
('CRYPTO',null,'Bitcoin ETF inflows hit $1.2B in single day — institutional FOMO accelerating','Spot Bitcoin ETFs recorded their largest single-day inflow since launch. BlackRock IBIT now holds $18B in BTC. Halving supply shock combined with institutional demand creating technical setup bulls have been waiting for.','news','CoinDesk',69,31,'macro',null,null),

-- GOOGL
('GOOGL','Alphabet Inc.','Google Gemini Ultra 2.0 beats GPT-4 on 8 of 10 benchmarks — search AI integration incoming','Alphabet released Gemini Ultra 2.0 outperforming OpenAI on coding, reasoning and multimodal tasks. Deep integration with Google Search rolling out to 1B+ users. AI Overviews already in 100 countries. Monetization next.','news','TechCrunch',67,33,'stock',175.43,1.22),
('GOOGL','Alphabet Inc.','YouTube ad revenue grows 21% YoY — shorts monetization finally kicking in','YouTube posted $9.5B in ad revenue, up 21% YoY. Shorts ad load increasing with minimal viewer churn. YouTube TV subscriber growth accelerating. Connected TV ad market share climbing at expense of linear TV.','news','Bloomberg',71,29,'stock',175.43,1.22),

-- JPM
('JPM','JPMorgan Chase','JPMorgan beats Q1 estimates — net interest income holds despite rate cut fears','JPMorgan posted $14.3B in net income, beating estimates by 8%. Net interest income held at $23B despite market pricing in rate cuts. Investment banking fees up 27%. Jamie Dimon warns of geopolitical risks ahead.','news','WSJ',64,36,'stock',198.87,0.87);
