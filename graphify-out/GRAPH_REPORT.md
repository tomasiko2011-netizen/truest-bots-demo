# Graph Report - .  (2026-06-11)

## Corpus Check
- Corpus is ~5,464 words - fits in a single context window. You may not need a graph.

## Summary
- 119 nodes · 258 edges · 10 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.75)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Shop Bot Handlers|Shop Bot Handlers]]
- [[_COMMUNITY_Booking Bot Flow|Booking Bot Flow]]
- [[_COMMUNITY_Price Monitor Bot|Price Monitor Bot]]
- [[_COMMUNITY_AI Booking Handlers|AI Booking Handlers]]
- [[_COMMUNITY_AI Bot Config & State|AI Bot Config & State]]
- [[_COMMUNITY_Vercel Deployment Config|Vercel Deployment Config]]
- [[_COMMUNITY_AI Conversation History|AI Conversation History]]
- [[_COMMUNITY_AI Bot Admin Controls|AI Bot Admin Controls]]
- [[_COMMUNITY_Package Config|Package Config]]
- [[_COMMUNITY_Public Landing & CI|Public Landing & CI]]

## God Nodes (most connected - your core abstractions)
1. `handler()` - 15 edges
2. `send()` - 14 edges
3. `handler()` - 14 edges
4. `tg()` - 13 edges
5. `handleTextMessage()` - 12 edges
6. `handleCallback()` - 11 edges
7. `tg()` - 9 edges
8. `handleCallback()` - 8 edges
9. `getSession()` - 7 edges
10. `handleStart()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `CI Syntax Check Workflow` --references--> `Truest Bots Demo Redirect`  [INFERRED]
  .github/workflows/ci.yml → public/index.html

## Import Cycles
- None detected.

## Communities (10 total, 0 thin omitted)

### Community 0 - "Shop Bot Handlers"
Cohesion: 0.20
Nodes (24): cartHasItems(), carts, cartText(), cartTotal(), CATEGORIES, config, getCart(), handleAdd() (+16 more)

### Community 1 - "Booking Bot Flow"
Cohesion: 0.20
Nodes (18): clearSession(), config, datesKb(), DAY_NAMES, getSession(), handleCallback(), handleMessage(), handler() (+10 more)

### Community 2 - "Price Monitor Bot"
Cohesion: 0.30
Nodes (18): backMenuKb(), config, DEMO_PRODUCTS, fmt(), handleAddProduct(), handleBackMain(), handleCallback(), handleCheckNow() (+10 more)

### Community 3 - "AI Booking Handlers"
Cohesion: 0.29
Nodes (13): getDateButtons(), getDoctorButtons(), getTimeButtons(), handleBookStart(), handleContacts(), handleDateSelect(), handleDoctorSelect(), handlePrices() (+5 more)

### Community 4 - "AI Bot Config & State"
Cohesion: 0.22
Nodes (10): answer(), config, conversations, DAY_NAMES, DOCTORS, MAIN_MENU, sessions, tg() (+2 more)

### Community 5 - "Vercel Deployment Config"
Cohesion: 0.18
Nodes (10): maxDuration, maxDuration, maxDuration, maxDuration, functions, api/ai.js, api/booking.js, api/price.js (+2 more)

### Community 6 - "AI Conversation History"
Cohesion: 0.39
Nodes (8): addToHistory(), askAI(), getHistory(), getSession(), handleNameInput(), handlePhoneInput(), handleTextMessage(), sanitize()

### Community 7 - "AI Bot Admin Controls"
Cohesion: 0.40
Nodes (5): ADMIN_ID(), clearHistory(), clearSession(), handleStart(), notifyAdmin()

### Community 8 - "Package Config"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 9 - "Public Landing & CI"
Cohesion: 0.67
Nodes (3): Truest Bots Demo Redirect, bots.truest.kz, CI Syntax Check Workflow

## Knowledge Gaps
- **29 isolated node(s):** `conversations`, `sessions`, `DOCTORS`, `WORK_HOURS`, `DAY_NAMES` (+24 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `handler()` connect `AI Booking Handlers` to `AI Bot Config & State`, `AI Conversation History`, `AI Bot Admin Controls`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `conversations`, `sessions`, `DOCTORS` to the rest of the system?**
  _29 weakly-connected nodes found - possible documentation gaps or missing edges._