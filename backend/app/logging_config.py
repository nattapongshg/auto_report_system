"""Structured logging configuration."""

import logging
import sys


def setup_logging(level: str = "INFO") -> None:
    """Initialize root logger with a consistent format.

    Called once at app startup. Other modules just do
    `logger = logging.getLogger(__name__)`.
    """
    root = logging.getLogger()
    # Avoid re-adding handlers on uvicorn --reload
    if root.handlers:
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(
        "%(asctime)s %(levelname)-5s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    ))
    root.addHandler(handler)
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Quieter defaults for noisy libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
