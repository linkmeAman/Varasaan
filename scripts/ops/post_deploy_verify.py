#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from urllib import error, request


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str


def fetch(url: str, timeout: float) -> tuple[int, bytes, dict[str, str]]:
    req = request.Request(url, headers={"Accept": "application/json"})
    with request.urlopen(req, timeout=timeout) as response:
        headers = {key.lower(): value for key, value in response.headers.items()}
        return response.status, response.read(), headers


def run_check(name: str, fn) -> CheckResult:
    try:
        return fn()
    except AssertionError as exc:
        return CheckResult(name=name, ok=False, detail=str(exc) or "assertion failed")
    except error.HTTPError as exc:
        return CheckResult(name=name, ok=False, detail=f"HTTP {exc.code}: {exc.reason}")
    except Exception as exc:  # pragma: no cover - defensive wrapper for ops usage
        return CheckResult(name=name, ok=False, detail=str(exc))


def main() -> int:
    parser = argparse.ArgumentParser(description="Run post-deploy verification checks for Varasaan.")
    parser.add_argument("--api-base-url", required=True, help="Base URL for the backend API, for example https://api.example.com")
    parser.add_argument("--web-base-url", required=True, help="Base URL for the frontend app, for example https://app.example.com")
    parser.add_argument("--timeout", type=float, default=10.0, help="HTTP timeout in seconds")
    args = parser.parse_args()

    api_base = args.api_base_url.rstrip("/")
    web_base = args.web_base_url.rstrip("/")
    timeout = args.timeout

    def health_check() -> CheckResult:
        status_code, body, _headers = fetch(f"{api_base}/healthz", timeout)
        assert status_code == 200, f"expected 200, received {status_code}"
        payload = json.loads(body.decode("utf-8"))
        assert payload.get("status") == "ok", f"unexpected health payload: {payload}"
        return CheckResult(name="api-health", ok=True, detail="/healthz returned status=ok")

    def csrf_check() -> CheckResult:
        status_code, body, headers = fetch(f"{api_base}/api/v1/auth/csrf", timeout)
        assert status_code == 200, f"expected 200, received {status_code}"
        payload = json.loads(body.decode("utf-8"))
        assert payload.get("csrf_token"), "csrf_token missing from response"
        set_cookie = headers.get("set-cookie", "")
        assert set_cookie, "Set-Cookie header missing on CSRF bootstrap"
        return CheckResult(name="csrf-bootstrap", ok=True, detail="CSRF endpoint returned token and cookie")

    def legal_policy_check() -> CheckResult:
        status_code, body, _headers = fetch(f"{api_base}/api/v1/legal/policies", timeout)
        assert status_code == 200, f"expected 200, received {status_code}"
        payload = json.loads(body.decode("utf-8"))
        assert isinstance(payload, list), "legal policies response is not a list"
        return CheckResult(name="legal-policies", ok=True, detail=f"policy count={len(payload)}")

    def web_check() -> CheckResult:
        req = request.Request(f"{web_base}/", headers={"Accept": "text/html"})
        with request.urlopen(req, timeout=timeout) as response:
            body = response.read().decode("utf-8", errors="ignore")
            assert response.status == 200, f"expected 200, received {response.status}"
            assert "Varasaan" in body, "frontend landing page did not include expected branding"
        return CheckResult(name="web-home", ok=True, detail="frontend responded with Varasaan landing page")

    results = [
        run_check("api-health", health_check),
        run_check("csrf-bootstrap", csrf_check),
        run_check("legal-policies", legal_policy_check),
        run_check("web-home", web_check),
    ]

    for result in results:
        status_label = "PASS" if result.ok else "FAIL"
        print(f"[{status_label}] {result.name}: {result.detail}")

    failures = [result for result in results if not result.ok]
    if failures:
        print(f"Verification failed: {len(failures)} check(s) did not pass.", file=sys.stderr)
        return 1

    print("All post-deploy verification checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
