import httpx
from app.config import settings


class SupabaseClient:
    """Thin wrapper around Supabase REST API (PostgREST)."""

    def __init__(self):
        self.url = settings.supabase_url.rstrip("/")
        self.key = settings.supabase_service_key
        self._headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }

    def _h(self, extra: dict | None = None) -> dict:
        h = {**self._headers}
        if extra:
            h.update(extra)
        return h

    async def select(self, table: str, params: str = "", single: bool = False) -> list | dict | None:
        prefer = "return=representation"
        if single:
            prefer += ", count=exact"
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(
                f"{self.url}/{table}?{params}",
                headers=self._h({"Accept": "application/json"} if not single else {"Accept": "application/vnd.pgrst.object+json"}),
            )
            if r.status_code == 406:  # no rows for single
                return None
            r.raise_for_status()
            return r.json()

    async def count(self, table: str, params: str = "") -> int:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.head(
                f"{self.url}/{table}?{params}",
                headers=self._h({"Prefer": "count=exact"}),
            )
            r.raise_for_status()
            return int(r.headers.get("content-range", "*/0").split("/")[-1])

    async def insert(self, table: str, data: dict) -> dict:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(
                f"{self.url}/{table}",
                headers=self._h({"Prefer": "return=representation"}),
                json=data,
            )
            r.raise_for_status()
            rows = r.json()
            return rows[0] if rows else {}

    async def insert_many(self, table: str, rows: list[dict]) -> list[dict]:
        if not rows:
            return []
        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.post(
                f"{self.url}/{table}",
                headers=self._h({"Prefer": "return=representation"}),
                json=rows,
            )
            r.raise_for_status()
            return r.json()

    async def update(self, table: str, match_params: str, data: dict) -> dict:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.patch(
                f"{self.url}/{table}?{match_params}",
                headers=self._h({"Prefer": "return=representation"}),
                json=data,
            )
            r.raise_for_status()
            rows = r.json()
            return rows[0] if rows else {}

    async def delete(self, table: str, match_params: str) -> None:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.delete(
                f"{self.url}/{table}?{match_params}",
                headers=self._h(),
            )
            r.raise_for_status()


supabase = SupabaseClient()
