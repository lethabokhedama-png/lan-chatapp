import os
from pathlib import Path

_here = Path(__file__).parent

DATA_PATH = os.environ.get("DATA_PATH", str(_here.parent / "DATA"))
PORT      = int(os.environ.get("DH_PORT", 8000))
HOST      = os.environ.get("HOST", "0.0.0.0")
TOKEN_TTL = int(os.environ.get("TOKEN_TTL", 86400))
SHARD_WARN_CAP = 10_000
SECRET: str = ""
