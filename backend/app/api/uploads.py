import os
import uuid

from fastapi import APIRouter, UploadFile, File
from fastapi.responses import FileResponse

router = APIRouter(prefix="/uploads", tags=["uploads"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("")
async def upload_file(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename or "file")[1]
    saved_name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, saved_name)

    content = await file.read()
    with open(path, "wb") as f:
        f.write(content)

    return {
        "filename": saved_name,
        "original_name": file.filename,
        "size": len(content),
        "url": f"/api/v1/uploads/{saved_name}",
    }


@router.get("/{filename}")
async def get_file(filename: str):
    path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(path):
        return {"error": "not found"}
    return FileResponse(path)
