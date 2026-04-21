import re

import httpx

from app.config import settings


class MetabaseClient:
    """Client for Metabase API - fetches question data and metadata."""

    def __init__(self):
        self.base_url = settings.metabase_base_url.rstrip("/")
        self.api_key = settings.metabase_api_key

    def _headers(self) -> dict:
        return {"x-api-key": self.api_key}

    @staticmethod
    def extract_question_id(url: str) -> int:
        """Extract question ID from a Metabase URL like /question/35-slug."""
        match = re.search(r"/question/(\d+)", url)
        if not match:
            raise ValueError(f"Cannot extract question ID from URL: {url}")
        return int(match.group(1))

    async def get_question_metadata(self, question_id: int) -> dict:
        """Fetch question metadata including column info."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self.base_url}/api/card/{question_id}",
                headers=self._headers(),
            )
            resp.raise_for_status()
            data = resp.json()

            columns = []
            for col in data.get("result_metadata", []):
                columns.append(
                    {
                        "name": col.get("name"),
                        "display_name": col.get("display_name"),
                        "base_type": col.get("base_type"),
                        "semantic_type": col.get("semantic_type"),
                    }
                )

            return {
                "question_id": question_id,
                "name": data.get("name"),
                "description": data.get("description"),
                "columns": columns,
            }

    async def fetch_question_json(
        self,
        question_id: int,
        parameters: dict | None = None,
        limit: int | None = None,
        timeout_seconds: int = 300,
    ) -> list[dict]:
        """Fetch question results as JSON rows."""
        body = parameters or {}

        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            resp = await client.post(
                f"{self.base_url}/api/card/{question_id}/query/json",
                headers=self._headers(),
                json=body,
            )
            resp.raise_for_status()
            rows = resp.json()

            if limit and len(rows) > limit:
                rows = rows[:limit]

            return rows

    async def fetch_question_xlsx(
        self,
        question_id: int,
        parameters: dict | None = None,
        timeout_seconds: int = 300,
    ) -> bytes:
        """Fetch question results as XLSX bytes."""
        body = parameters or {}

        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            resp = await client.post(
                f"{self.base_url}/api/card/{question_id}/query/xlsx",
                headers=self._headers(),
                json=body,
            )
            resp.raise_for_status()
            return resp.content
