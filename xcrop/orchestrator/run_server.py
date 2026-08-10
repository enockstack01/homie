"""Entry point for the PyInstaller-compiled orchestrator binary.

`uvicorn app.main:app` (the dev-mode CLI invocation, see electron/main.ts's
resolveOrchestratorPython path) resolves its app target by dynamic string import, which
PyInstaller's static import analysis can't see - calling uvicorn.run() with the app object
already imported here makes the dependency an ordinary, discoverable Python import instead.
"""

import argparse

import uvicorn

from app.main import app


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8756)
    args = parser.parse_args()
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
