from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import Base, engine, ensure_schema
from .routers import batches, exports, generation, images, logs, projects, settings

Base.metadata.create_all(bind=engine)
ensure_schema()

app = FastAPI(title="Dataset Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(settings.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(batches.router, prefix="/api")
app.include_router(images.router, prefix="/api")
app.include_router(generation.router, prefix="/api")
app.include_router(exports.router, prefix="/api")
app.include_router(logs.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
