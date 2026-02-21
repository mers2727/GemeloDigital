from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, datasets, twin, scenarios

app = FastAPI(
    title="GemeloDigital API",
    description="Multi-tenant pricing elasticity digital twin",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(datasets.router)
app.include_router(twin.router)
app.include_router(scenarios.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
