"""STUB. Cited Q&A endpoint (Tier 2). Not wired up yet.

Contract (see CLAUDE.md > LLM usage):
- POST {question} -> {answer, cited_chunk_ids, mode: "live" | "offline"}
- Offline mode (default when ANTHROPIC_API_KEY is unset or OFFLINE=1) serves data/qa_cache only.
- Low max_tokens. Key is read from the server environment only; never sent to the browser.
"""
import json
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps({"status": "stub", "mode": "offline"}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)
