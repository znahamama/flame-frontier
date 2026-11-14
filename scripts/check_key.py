"""One minimal Anthropic API call to confirm ANTHROPIC_API_KEY works.

Prints ONLY "key OK", or the error type and HTTP status code. Never prints the key,
any part of it, or the API's error message text.
Cost: a few tokens on the cheapest current model (claude-haiku-5-5).
Not part of the numbered pipeline; run by hand: .venv/bin/python scripts/check_key.py
"""
import os
import sys
from pathlib import Path

import anthropic
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
if not os.environ.get("ANTHROPIC_API_KEY"):
    print("error: ANTHROPIC_API_KEY not set (check .env)")
    sys.exit(2)

client = anthropic.Anthropic(max_retries=0, timeout=30.0)
try:
    client.messages.create(
        model="claude-haiku-5-5",
        max_tokens=5,
        thinking={"type": "disabled"},  # allowed on Haiku 5.5 at effort <= high
        output_config={"effort": "low"},
        messages=[{"role": "user", "content": "Say OK"}],
    )
    print("key OK")
except anthropic.APIStatusError as e:  # 4xx/5xx: report class + status only
    print(f"error: {type(e).__name__} status={e.status_code}")
    sys.exit(1)
except anthropic.APIConnectionError as e:  # network/timeout: no status code
    print(f"error: {type(e).__name__} status=none")
    sys.exit(1)
