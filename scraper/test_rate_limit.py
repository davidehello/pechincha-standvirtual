"""
Rate Limit Tester for StandVirtual API

Tests different request rates to find the optimal speed without getting blocked.
Starts fast and backs off when rate limited, recording the results.
"""
import time
import requests
import statistics
from dataclasses import dataclass
from typing import Optional

from config import GRAPHQL_ENDPOINT, HEADERS, get_request_body


@dataclass
class TestResult:
    delay_seconds: float
    requests_made: int
    successful: int
    rate_limited: int
    errors: int
    avg_response_time: float
    requests_per_minute: float


def test_rate(delay_seconds: float, num_requests: int = 20) -> TestResult:
    """
    Test a specific request rate.

    Args:
        delay_seconds: Delay between requests
        num_requests: Number of requests to make

    Returns:
        TestResult with statistics
    """
    session = requests.Session()
    session.headers.update(HEADERS)

    successful = 0
    rate_limited = 0
    errors = 0
    response_times = []

    print(f"\nTesting {delay_seconds:.2f}s delay ({60/delay_seconds:.1f} req/min)...")

    for i in range(num_requests):
        page = (i % 100) + 1  # Cycle through first 100 pages

        start = time.time()
        try:
            response = session.post(
                GRAPHQL_ENDPOINT,
                json=get_request_body(page),
                timeout=30
            )
            elapsed = time.time() - start
            response_times.append(elapsed)

            if response.status_code == 429:
                rate_limited += 1
                print(f"  [{i+1}/{num_requests}] RATE LIMITED (429)")
            elif response.status_code == 200:
                data = response.json()
                if "errors" in data:
                    errors += 1
                    print(f"  [{i+1}/{num_requests}] GraphQL error")
                else:
                    successful += 1
                    if (i + 1) % 5 == 0:
                        print(f"  [{i+1}/{num_requests}] OK ({elapsed:.2f}s)")
            else:
                errors += 1
                print(f"  [{i+1}/{num_requests}] HTTP {response.status_code}")

        except Exception as e:
            errors += 1
            print(f"  [{i+1}/{num_requests}] Error: {e}")

        # Stop if we're getting rate limited too much
        if rate_limited >= 3:
            print(f"  Stopping early - too many rate limits")
            break

        if i < num_requests - 1:
            time.sleep(delay_seconds)

    session.close()

    total_time = sum(response_times) + (len(response_times) - 1) * delay_seconds
    actual_rpm = (len(response_times) / total_time) * 60 if total_time > 0 else 0

    return TestResult(
        delay_seconds=delay_seconds,
        requests_made=successful + rate_limited + errors,
        successful=successful,
        rate_limited=rate_limited,
        errors=errors,
        avg_response_time=statistics.mean(response_times) if response_times else 0,
        requests_per_minute=actual_rpm
    )


def find_optimal_rate():
    """
    Find the optimal rate by testing different delays.
    Starts aggressive and backs off.
    """
    print("=" * 60)
    print("StandVirtual Rate Limit Tester")
    print("=" * 60)
    print("\nThis will test different request rates to find the optimal speed.")
    print("Starting with aggressive rates and backing off if needed.\n")

    # Test delays from fast to slow
    test_delays = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0]
    results = []

    for delay in test_delays:
        result = test_rate(delay, num_requests=15)
        results.append(result)

        print(f"\n  Results: {result.successful}/{result.requests_made} successful, "
              f"{result.rate_limited} rate limited, {result.errors} errors")
        print(f"  Effective rate: {result.requests_per_minute:.1f} req/min")

        # If we got good results with no rate limiting, we found a good rate
        if result.rate_limited == 0 and result.errors == 0:
            print(f"\n  [OK] {delay}s delay works well!")

        # If heavily rate limited, no point testing faster rates
        if result.rate_limited >= 3:
            print(f"\n  [FAIL] Too aggressive, skipping faster rates")
            break

        # Brief pause between test batches
        print("\n  Waiting 5s before next test...")
        time.sleep(5)

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"\n{'Delay':<10} {'Success':<10} {'Rate Ltd':<10} {'Errors':<10} {'Req/min':<10}")
    print("-" * 50)

    best_result = None
    for r in results:
        status = "[OK]" if r.rate_limited == 0 and r.errors == 0 else "[X]"
        print(f"{r.delay_seconds:<10.2f} {r.successful:<10} {r.rate_limited:<10} {r.errors:<10} {r.requests_per_minute:<10.1f} {status}")

        if r.rate_limited == 0 and r.errors == 0:
            if best_result is None or r.requests_per_minute > best_result.requests_per_minute:
                best_result = r

    if best_result:
        print(f"\n[OK] RECOMMENDED SETTINGS:")
        print(f"  REQUESTS_PER_MINUTE = {int(best_result.requests_per_minute)}")
        print(f"  MIN_DELAY_SECONDS = {best_result.delay_seconds}")
        print(f"  MAX_DELAY_SECONDS = {best_result.delay_seconds + 0.5}")

        estimated_time = 1334 / best_result.requests_per_minute
        print(f"\n  Estimated full scrape time: {estimated_time:.0f} minutes")
    else:
        print("\n[X] All rates were rate limited. The API might be blocking your IP.")
        print("  Try again later or use a VPN.")

    return results


def quick_test():
    """Quick test with current settings to see if they work."""
    from config import REQUESTS_PER_MINUTE, MIN_DELAY_SECONDS

    print("=" * 60)
    print("Quick Test - Current Settings")
    print("=" * 60)
    print(f"\nCurrent config: {REQUESTS_PER_MINUTE} req/min, {MIN_DELAY_SECONDS}s min delay")

    result = test_rate(MIN_DELAY_SECONDS, num_requests=10)

    print(f"\nResults: {result.successful}/{result.requests_made} successful")
    if result.rate_limited > 0:
        print(f"[!] Got {result.rate_limited} rate limits - consider increasing delay")
    else:
        print("[OK] Current settings work well!")

    return result


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "--quick":
        quick_test()
    else:
        find_optimal_rate()
