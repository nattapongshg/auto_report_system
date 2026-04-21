from fastapi import APIRouter, HTTPException

from app.engine.metabase_client import MetabaseClient

router = APIRouter(prefix="/metabase", tags=["metabase"])
client = MetabaseClient()


@router.get("/questions/{question_id}/metadata")
async def get_question_metadata(question_id: int):
    """Fetch column names and types from a Metabase question."""
    try:
        metadata = await client.get_question_metadata(question_id)
        return metadata
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/questions/{question_id}/preview")
async def preview_question(question_id: int, parameters: dict | None = None):
    """Fetch first 10 rows from a Metabase question for preview."""
    try:
        data = await client.fetch_question_json(question_id, parameters=parameters, limit=10)
        return {"rows": data, "count": len(data)}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
