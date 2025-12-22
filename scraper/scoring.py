"""
Deal Score Calculator

Calculates a 0-100 deal score based on:
- Price evaluation (BELOW/IN/ABOVE market) - 50% weight
- Mileage relative to year - 25% weight
- Car age - 15% weight
- Listing freshness - 10% weight
"""
import json
from datetime import datetime
from typing import Optional


def calculate_deal_score(listing: dict) -> tuple[float, dict]:
    """
    Calculate deal score for a listing.

    Returns:
        Tuple of (score 0-100, breakdown dict)
    """
    breakdown = {}
    total_score = 0

    # 1. Price Evaluation Score (50% weight)
    # BELOW = 100, IN = 50, ABOVE = 0
    price_eval = listing.get("price_evaluation", "").upper()
    if price_eval == "BELOW":
        price_score = 100
    elif price_eval == "IN":
        price_score = 50
    elif price_eval == "ABOVE":
        price_score = 10
    else:
        price_score = 50  # Unknown = average

    breakdown["price_evaluation"] = {
        "score": price_score,
        "weight": 0.5,
        "value": price_eval or "UNKNOWN"
    }
    total_score += price_score * 0.5

    # 2. Mileage Score (25% weight)
    # Lower mileage = better score
    # Expected: ~15,000 km/year average
    year = listing.get("year")
    mileage = listing.get("mileage")

    if year and mileage:
        current_year = datetime.now().year
        car_age = max(1, current_year - year)
        expected_mileage = car_age * 15000

        # Ratio: actual vs expected (lower is better)
        mileage_ratio = mileage / expected_mileage if expected_mileage > 0 else 1

        if mileage_ratio <= 0.5:
            mileage_score = 100  # Very low mileage
        elif mileage_ratio <= 0.75:
            mileage_score = 85
        elif mileage_ratio <= 1.0:
            mileage_score = 70  # Average mileage
        elif mileage_ratio <= 1.25:
            mileage_score = 50
        elif mileage_ratio <= 1.5:
            mileage_score = 30
        else:
            mileage_score = 10  # High mileage

        breakdown["mileage"] = {
            "score": mileage_score,
            "weight": 0.25,
            "value": mileage,
            "expected": expected_mileage,
            "ratio": round(mileage_ratio, 2)
        }
    else:
        mileage_score = 50  # Unknown = average
        breakdown["mileage"] = {
            "score": mileage_score,
            "weight": 0.25,
            "value": None
        }

    total_score += mileage_score * 0.25

    # 3. Age Score (15% weight)
    # Newer cars score higher
    if year:
        current_year = datetime.now().year
        car_age = current_year - year

        if car_age <= 1:
            age_score = 100
        elif car_age <= 3:
            age_score = 85
        elif car_age <= 5:
            age_score = 70
        elif car_age <= 8:
            age_score = 50
        elif car_age <= 12:
            age_score = 30
        else:
            age_score = 15

        breakdown["age"] = {
            "score": age_score,
            "weight": 0.15,
            "value": car_age,
            "year": year
        }
    else:
        age_score = 50
        breakdown["age"] = {
            "score": age_score,
            "weight": 0.15,
            "value": None
        }

    total_score += age_score * 0.15

    # 4. Listing Freshness Score (10% weight)
    # Newer listings score higher
    listing_date = listing.get("listing_date")

    if listing_date:
        # listing_date is Unix timestamp
        if isinstance(listing_date, (int, float)):
            listing_dt = datetime.fromtimestamp(listing_date)
        else:
            listing_dt = datetime.now()

        days_old = (datetime.now() - listing_dt).days

        if days_old <= 1:
            freshness_score = 100
        elif days_old <= 3:
            freshness_score = 85
        elif days_old <= 7:
            freshness_score = 70
        elif days_old <= 14:
            freshness_score = 50
        elif days_old <= 30:
            freshness_score = 30
        else:
            freshness_score = 15

        breakdown["freshness"] = {
            "score": freshness_score,
            "weight": 0.10,
            "days_old": days_old
        }
    else:
        freshness_score = 50
        breakdown["freshness"] = {
            "score": freshness_score,
            "weight": 0.10,
            "days_old": None
        }

    total_score += freshness_score * 0.10

    # Round to 1 decimal
    total_score = round(total_score, 1)

    return total_score, breakdown


def calculate_scores_for_listings(listings: list[dict]) -> list[dict]:
    """
    Calculate deal scores for a batch of listings.
    Adds deal_score and score_breakdown to each listing.
    """
    for listing in listings:
        score, breakdown = calculate_deal_score(listing)
        listing["deal_score"] = score
        listing["score_breakdown"] = json.dumps(breakdown)

    return listings
