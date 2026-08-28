from fastapi import FastAPI

app = FastAPI(
    title="JalDrishti API",
    description="Backend API for the JalDrishti SIH 2026 project",
    version="0.1.0",
)


@app.get("/")
async def root():
    return {
        "message": "JalDrishti API is running!",
        "status": "success"
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy"
    }