"""
Shared type constants and schema documentation.
Not enforced at runtime — used as reference and for IDE hints.
"""

# Receipt states (ordered by upgrade path)
RECEIPT_STATES = ("queued", "sent", "delivered", "seen")

# Message types
MSG_TYPES = ("text", "image", "file", "voice", "system")

# Presence states
PRESENCE_STATES = ("online", "away", "offline")

# Theme palettes
PALETTES = (
    "default",
    "midnight_blue",
    "grape_soda",
    "forest_moss",
    "sunset_ember",
    "ocean_teal",
    "bubblegum",
    "solarized_sand",
)

# Room types
ROOM_TYPES = ("channel", "dm")

# Member roles
MEMBER_ROLES = ("owner", "admin", "member")