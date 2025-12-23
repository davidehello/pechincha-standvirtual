# Implementation Plan: Improved Deal Scoring Algorithm & Price History Feature

## Part 1: Current Algorithm Analysis & Flaws

### Current Python Scoring (scraper/scoring.py)
- **price_evaluation** (50%): Based on StandVirtual's evaluation (BELOW/IN/ABOVE market)
- **mileage** (25%): Step-based scoring by mileage ranges
- **age** (15%): Step-based scoring by car age
- **freshness** (10%): Days since listing was posted

### Current TypeScript Scoring (api/settings/recalculate)
- **priceVsSegment** (35%): Compares to segment min/max prices
- **priceEvaluation** (25%): Binary conversion of StandVirtual evaluation
- **mileageQuality** (25%): Mileage vs expected 15k/year
- **pricePerKm** (15%): Price divided by mileage

### Identified Flaws

1. **Price vs Segment uses min/max** - Sensitive to outliers (one cheap wreck skews all scores)
2. **Price Evaluation is too coarse** - Binary 100/50/10 scoring lacks granularity
3. **Fixed 15k km/year assumption** - Doesn't account for diesel (20k+) vs gasoline (12k)
4. **Price per Km favors high-mileage too much** - A 200k km car for €5k scores higher than 50k km for €10k
5. **No depreciation curve** - Doesn't use industry-standard depreciation rates
6. **Freshness rewards old listings** - Should reward RECENT listings (motivated sellers)
7. **Missing: Price drop detection** - Significant price drops indicate motivated sellers

---

## Part 2: New Improved Algorithm Design

### New Scoring Components

#### 1. Market Position Score (30%)
Instead of min/max, use percentile-based comparison:
- Calculate segment median and percentile ranks
- Score = 100 * (1 - percentile_rank) where lower percentile = cheaper = better
- Accounts for outliers by using median-based statistics

#### 2. Value Depreciation Score (25%)
Use industry-standard depreciation curves:
- Year 1: ~24% depreciation
- Years 2-5: ~14% per year
- Years 6+: ~10% per year
- Calculate expected value based on original MSRP estimates
- Score based on how much below expected depreciated value

#### 3. Mileage Quality Score (20%)
Fuel-type adjusted expected mileage:
- Diesel: 20,000 km/year expected
- Gasoline: 12,000 km/year expected
- Electric: 15,000 km/year expected
- Hybrid: 15,000 km/year expected
- Score = how much below expected mileage for the car's age

#### 4. Price Drop Bonus (15%)
Reward recent price reductions:
- 20%+ drop in last 7 days: +100 points
- 10-20% drop in last 14 days: +80 points
- 5-10% drop in last 30 days: +60 points
- Any drop in last 30 days: +40 points
- No price history or increases: 0 points

#### 5. Listing Freshness Score (10%)
Inverted logic - reward RECENT listings:
- Less than 24 hours: 100 points
- 1-3 days: 80 points
- 4-7 days: 60 points
- 1-2 weeks: 40 points
- 2-4 weeks: 20 points
- Older: 0 points

### Implementation Approach

Both Python and TypeScript implementations need to be unified with the same algorithm for consistency.

---

## Part 3: Price History Feature

### Database
Already exists: `price_history` table with `id`, `listingId`, `price`, `recordedAt`

### New API Endpoint
Create `/api/deals/[id]/price-history` to fetch price history for a listing

### UI Changes

#### DealCard Component
- Add price history indicator badge when listing has price changes
- Badge shows: "↓15%" (price drop percentage) or "Price Changed"
- Color coding: Green for drops, red for increases
- Clicking opens price history modal/popover

#### Price History Display
- Modal or expandable section showing:
  - Current price (highlighted)
  - Previous prices with dates
  - Visual chart/timeline of price changes
  - Percentage change indicators

---

## Part 4: Implementation Steps

### Step 1: Create Price History API
- [ ] Create `/api/deals/[id]/price-history/route.ts`
- [ ] Return array of {price, recordedAt} sorted by date

### Step 2: Add Price History to Listing Type
- [ ] Add `priceHistory` field to TListing type
- [ ] Add `hasPriceChanges` computed field
- [ ] Add `priceDropPercent` computed field

### Step 3: Update DealCard UI
- [ ] Add price history indicator badge
- [ ] Create PriceHistoryPopover component
- [ ] Add translations for price history labels

### Step 4: Implement New Algorithm (TypeScript)
- [ ] Create new scoring functions in `/lib/scoring/`
- [ ] Update recalculate endpoint to use new algorithm
- [ ] Add segment statistics calculation

### Step 5: Update Python Scraper Algorithm
- [ ] Update `scraper/scoring.py` with same algorithm
- [ ] Ensure consistency between Python and TypeScript

### Step 6: Testing & Validation
- [ ] Compare old vs new scores on sample listings
- [ ] Verify price history displays correctly
- [ ] Test edge cases (no price history, single record, etc.)
