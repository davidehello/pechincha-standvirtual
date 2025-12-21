"""
Adaptive rate limiter for API requests
"""
import time
import random
import logging
from typing import Optional

from config import (
    REQUESTS_PER_MINUTE,
    MIN_DELAY_SECONDS,
    MAX_DELAY_SECONDS,
)

logger = logging.getLogger(__name__)


class AdaptiveRateLimiter:
    """
    Rate limiter with adaptive backoff on errors.

    Features:
    - Random jitter between requests
    - Exponential backoff on rate limit errors
    - Gradual recovery after successful requests
    """

    def __init__(
        self,
        requests_per_minute: int = REQUESTS_PER_MINUTE,
        min_delay: float = MIN_DELAY_SECONDS,
        max_delay: float = MAX_DELAY_SECONDS,
    ):
        self.base_delay = 60.0 / requests_per_minute
        self.min_delay = min_delay
        self.max_delay = max_delay
        self.current_delay = self.base_delay
        self.last_request_time: Optional[float] = None
        self.consecutive_successes = 0
        self.backoff_multiplier = 1.0

    def wait(self):
        """Wait before next request with jitter"""
        if self.last_request_time is not None:
            elapsed = time.time() - self.last_request_time
            delay = self._calculate_delay()

            if elapsed < delay:
                sleep_time = delay - elapsed
                logger.debug(f"Rate limit: sleeping {sleep_time:.2f}s")
                time.sleep(sleep_time)

        self.last_request_time = time.time()

    def _calculate_delay(self) -> float:
        """Calculate delay with jitter and backoff"""
        # Apply backoff multiplier
        delay = self.current_delay * self.backoff_multiplier

        # Add random jitter (±20%)
        jitter = delay * 0.2 * (2 * random.random() - 1)
        delay += jitter

        # Clamp to bounds
        return max(self.min_delay, min(self.max_delay, delay))

    def on_success(self):
        """Call after successful request"""
        self.consecutive_successes += 1

        # Gradually reduce backoff after 5 consecutive successes
        if self.consecutive_successes >= 5 and self.backoff_multiplier > 1.0:
            self.backoff_multiplier = max(1.0, self.backoff_multiplier * 0.9)
            logger.info(f"Reducing backoff to {self.backoff_multiplier:.2f}x")
            self.consecutive_successes = 0

    def on_rate_limit(self):
        """Call when rate limited"""
        self.consecutive_successes = 0
        self.backoff_multiplier = min(4.0, self.backoff_multiplier * 2.0)
        logger.warning(f"Rate limited! Increasing backoff to {self.backoff_multiplier:.2f}x")

    def on_error(self):
        """Call on other errors"""
        self.consecutive_successes = 0
        # Smaller backoff for non-rate-limit errors
        self.backoff_multiplier = min(2.0, self.backoff_multiplier * 1.5)

    def get_stats(self) -> dict:
        """Get current rate limiter stats"""
        return {
            "current_delay": self._calculate_delay(),
            "backoff_multiplier": self.backoff_multiplier,
            "consecutive_successes": self.consecutive_successes,
        }
