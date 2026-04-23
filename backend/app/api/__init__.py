from fastapi import APIRouter

from app.api.metabase import router as metabase_router
from app.api.uploads import router as uploads_router
from app.api.privileges import router as privileges_router
from app.api.locations import router as locations_router
from app.api.monthly import router as monthly_router
from app.api.workflow import router as workflow_router
from app.api.schedules import router as schedules_router
from app.api.group_reports import router as group_reports_router
from app.api.electricity import router as electricity_router
from app.api.report_gen import router as report_gen_router
from app.api.report_templates import router as report_templates_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(metabase_router)
api_router.include_router(uploads_router)
api_router.include_router(privileges_router)
api_router.include_router(locations_router)
api_router.include_router(monthly_router)
api_router.include_router(workflow_router)
api_router.include_router(schedules_router)
api_router.include_router(group_reports_router)
api_router.include_router(electricity_router)
api_router.include_router(report_gen_router)
api_router.include_router(report_templates_router)
