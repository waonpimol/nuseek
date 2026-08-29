from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.items import router as items_router
from routes.agent import router as agent_router
from routes.search import router as search_router
from routes.notifications import router as notifications_router
from routes.matches import router as matches_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(items_router)
app.include_router(agent_router)
app.include_router(search_router)
app.include_router(notifications_router)
app.include_router(matches_router)


@app.get("/")
def home():
    return {
        "message": "NUSeek Backend"
    }