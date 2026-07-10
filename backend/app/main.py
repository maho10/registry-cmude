import os
from dotenv import load_dotenv

load_dotenv()  # must run before importing routes — they read env vars at module load time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import import_csv

app = FastAPI(title="CMUDE Registry API")

frontend_url = os.getenv("FRONTEND_URL", "*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(import_csv.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
