from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi.openapi.utils import get_openapi

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_SRC = REPO_ROOT / "backend" / "src"
if str(BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(BACKEND_SRC))

from app.main import app  # noqa: E402

OUTPUT_PATH = REPO_ROOT / "packages" / "shared" / "openapi" / "openapi.generated.json"


def main() -> None:
    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(schema, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote OpenAPI artifact to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
