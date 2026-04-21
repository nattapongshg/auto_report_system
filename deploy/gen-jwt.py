"""Generate JWTs for PostgREST roles.

Usage:
    python deploy/gen-jwt.py <jwt-secret>

Prints two JWTs to stdout: one for `service_role` (backend) and one for `anon`.
Paste them into the production .env as SERVICE_JWT and ANON_JWT.
"""

import base64
import hashlib
import hmac
import json
import sys
import time


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def sign(secret: str, role: str, ttl_seconds: int = 60 * 60 * 24 * 365 * 10) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "role": role,
        "iss": "auto-report-system",
        "iat": int(time.time()),
        "exp": int(time.time()) + ttl_seconds,
    }
    header_b = b64url(json.dumps(header, separators=(",", ":")).encode())
    payload_b = b64url(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{header_b}.{payload_b}".encode()
    sig = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    return f"{header_b}.{payload_b}.{b64url(sig)}"


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: python gen-jwt.py <jwt-secret-at-least-32-chars>", file=sys.stderr)
        sys.exit(1)
    secret = sys.argv[1]
    if len(secret) < 32:
        print("ERROR: JWT secret must be at least 32 characters", file=sys.stderr)
        sys.exit(1)
    print(f"SERVICE_JWT={sign(secret, 'service_role')}")
    print(f"ANON_JWT={sign(secret, 'anon')}")
