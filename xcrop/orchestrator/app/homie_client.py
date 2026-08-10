import httpx

from app.config import Settings

# Mirrors ../../src/xGIS.AddIn/Agent/ClaudeAgentService.cs's reason for existing: the
# gateway (backend/app/routes/chat.py) holds the only real Anthropic key and meters usage
# against the signed-in account's credit balance - xcrop must never call Anthropic
# directly, or AI usage here would be unbilled and unaudited against the same account the
# rest of the Homie platform tracks.


class HomieApiError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"Homie API error {status_code}: {detail}")


class HomieClient:
    def __init__(self, settings: Settings):
        if not settings.homie_api_key:
            raise HomieApiError(401, "No Homie API key configured. Set one in xcrop Settings.")
        self._base_url = settings.homie_api_base.rstrip("/")
        self._headers = {"Authorization": f"Bearer {settings.homie_api_key}"}

    async def whoami(self) -> dict:
        return await self._get("/v1/me")

    async def chat(
        self,
        messages: list[dict],
        system: str | None = None,
        max_tokens: int = 1024,
    ) -> dict:
        """Calls the same /v1/chat gateway the ArcGIS Pro Add-in uses - request/response
        shape mirrors Anthropic's Messages API (see backend/app/routes/chat.py)."""
        body = {"messages": messages, "system": system, "max_tokens": max_tokens}
        return await self._post("/v1/chat", body)

    async def _get(self, path: str) -> dict:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(f"{self._base_url}{path}", headers=self._headers)
        except httpx.HTTPError as exc:
            raise HomieApiError(503, f"Couldn't reach the Homie backend at {self._base_url}: {exc}") from exc
        return self._parse(response)

    async def _post(self, path: str, body: dict) -> dict:
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(f"{self._base_url}{path}", headers=self._headers, json=body)
        except httpx.HTTPError as exc:
            raise HomieApiError(503, f"Couldn't reach the Homie backend at {self._base_url}: {exc}") from exc
        return self._parse(response)

    def _parse(self, response: httpx.Response) -> dict:
        if response.status_code >= 400:
            detail = response.text
            try:
                detail = response.json().get("detail", detail)
            except ValueError:
                pass
            raise HomieApiError(response.status_code, detail)
        return response.json()
