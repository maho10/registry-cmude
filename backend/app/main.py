import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from .routes import import_csv

load_dotenv()

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
