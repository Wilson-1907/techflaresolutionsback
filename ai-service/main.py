"""
TechFlare Solutions AI Microservice
"""

import os
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
API_KEY = os.getenv("AI_SERVICE_API_KEY", "")

app = FastAPI(title="TechFlare Solutions AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def verify_key(x_api_key: str | None = Header(default=None)):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


class ChatRequest(BaseModel):
    message: str


class ProposalRequest(BaseModel):
    problem: str
    industry: str = ""
    budget: str = ""


class CostEstimateRequest(BaseModel):
    project_type: str
    complexity: str = "medium"
    timeline: str = "3-6 months"


@app.get("/health")
def health():
    return {"status": "healthy", "service": "techflare-ai"}


@app.post("/chat")
def chat(req: ChatRequest, x_api_key: str | None = Header(default=None)):
    verify_key(x_api_key)
    return {
        "reply": f"TechFlare Solutions AI received: '{req.message}'. "
        "Connect OPENAI_API_KEY for full LangGraph-powered responses."
    }


@app.post("/proposal")
def generate_proposal(req: ProposalRequest, x_api_key: str | None = Header(default=None)):
    verify_key(x_api_key)
    return {
        "proposal": f"Proposed solution for: {req.problem}",
        "estimated_cost": "$25,000 - $75,000",
        "phases": ["Discovery", "Design", "Development", "Deployment"],
    }


@app.post("/estimate")
def estimate_cost(req: CostEstimateRequest, x_api_key: str | None = Header(default=None)):
    verify_key(x_api_key)
    estimates = {
        "low": "$10,000 - $30,000",
        "medium": "$30,000 - $80,000",
        "high": "$80,000 - $200,000+",
    }
    return {"estimated_cost": estimates.get(req.complexity, estimates["medium"])}
