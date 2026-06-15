from fastapi import APIRouter

from src.api.routes import alerts, analytics, chat, forecast, health, memory, replenishment, vision

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(chat.router)
api_router.include_router(memory.router)
api_router.include_router(forecast.router)
api_router.include_router(replenishment.router)
api_router.include_router(vision.router)
api_router.include_router(alerts.router)
api_router.include_router(analytics.router)
