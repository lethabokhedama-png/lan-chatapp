"""
Central config. All tunables live here.
Reads from environment variables with sensible defaults.
"""
import os
from pathlib import Path

_here = Path(__file__).parent

DATA_PATH = os.environ.get("DATA_PATH", str(_here.parent / "DATA"))
SECRET    = os.environ.get("SECRET",    "lanchat-secret-change-me")
PORT      = int(os.environ.get("DH_PORT", 8000))
HOST      = os.environ.get("HOST",      "0.0.0.0")

# Token TTL in seconds (24 h)
TOKEN_TTL = int(os.environ.get("TOKEN_TTL", 86400))

# How many messages per monthly shard before we warn in logs
SHARD_WARN_CAP = 10_000