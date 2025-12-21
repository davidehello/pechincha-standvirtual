"""
Checkpoint management for resume capability
"""
import json
import time
import logging
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, asdict

from config import CHECKPOINT_PATH

logger = logging.getLogger(__name__)


@dataclass
class Checkpoint:
    """Scrape progress checkpoint"""
    last_page: int
    total_pages: int
    listings_found: int
    listings_new: int
    listings_updated: int
    timestamp: float
    status: str  # running, completed, failed

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "Checkpoint":
        return cls(**data)


class CheckpointManager:
    """Manages saving and loading scrape checkpoints"""

    def __init__(self, path: Path = CHECKPOINT_PATH):
        self.path = path

    def save(self, checkpoint: Checkpoint):
        """Save checkpoint to file"""
        try:
            with open(self.path, "w") as f:
                json.dump(checkpoint.to_dict(), f, indent=2)
            logger.debug(f"Checkpoint saved: page {checkpoint.last_page}/{checkpoint.total_pages}")
        except Exception as e:
            logger.error(f"Failed to save checkpoint: {e}")

    def load(self) -> Optional[Checkpoint]:
        """Load checkpoint from file"""
        if not self.path.exists():
            return None

        try:
            with open(self.path, "r") as f:
                data = json.load(f)
            checkpoint = Checkpoint.from_dict(data)

            # Check if checkpoint is stale (older than 24 hours)
            if time.time() - checkpoint.timestamp > 24 * 60 * 60:
                logger.warning("Checkpoint is older than 24 hours, starting fresh")
                return None

            # Only resume if it was running
            if checkpoint.status != "running":
                logger.info(f"Previous scrape {checkpoint.status}, starting fresh")
                return None

            logger.info(f"Resuming from page {checkpoint.last_page}/{checkpoint.total_pages}")
            return checkpoint
        except Exception as e:
            logger.error(f"Failed to load checkpoint: {e}")
            return None

    def clear(self):
        """Remove checkpoint file"""
        if self.path.exists():
            self.path.unlink()
            logger.debug("Checkpoint cleared")

    def create_initial(self, total_pages: int) -> Checkpoint:
        """Create initial checkpoint for new scrape"""
        checkpoint = Checkpoint(
            last_page=0,
            total_pages=total_pages,
            listings_found=0,
            listings_new=0,
            listings_updated=0,
            timestamp=time.time(),
            status="running"
        )
        self.save(checkpoint)
        return checkpoint

    def update(
        self,
        checkpoint: Checkpoint,
        page: int,
        new_listings: int = 0,
        updated_listings: int = 0,
        found_listings: int = 0,
    ) -> Checkpoint:
        """Update checkpoint with progress"""
        checkpoint.last_page = page
        checkpoint.listings_found += found_listings
        checkpoint.listings_new += new_listings
        checkpoint.listings_updated += updated_listings
        checkpoint.timestamp = time.time()
        self.save(checkpoint)
        return checkpoint

    def mark_completed(self, checkpoint: Checkpoint) -> Checkpoint:
        """Mark checkpoint as completed"""
        checkpoint.status = "completed"
        checkpoint.timestamp = time.time()
        self.save(checkpoint)
        return checkpoint

    def mark_failed(self, checkpoint: Checkpoint, error: str = "") -> Checkpoint:
        """Mark checkpoint as failed"""
        checkpoint.status = "failed"
        checkpoint.timestamp = time.time()
        self.save(checkpoint)
        return checkpoint
