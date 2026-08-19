import asyncio
import os

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from challenges import challenge_engine

app = FastAPI()
# In a real app, use a strong secret key from environment variables
app.add_middleware(SessionMiddleware, secret_key="SUPER_SECRET_KEY_FOR_CTF")

# Setup templates and static files
# Ensure we are in the correct directory relative to where main.py is
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

@app.get("/")
async def index(request: Request):
    return RedirectResponse(url="/llm/1")

@app.get("/llm/{level}", response_class=HTMLResponse)
async def get_level(request: Request, level: int):
    # IDOR Protection: Check if the level is unlocked in the session
    unlocked = request.session.get("unlocked_level", 1)
    
    if level > unlocked:
        # User is trying to skip levels, redirect to their current progress
        return RedirectResponse(url=f"/llm/{unlocked}")
    
    if level < 1:
        return RedirectResponse(url="/llm/1")
    if level > 10:
        return RedirectResponse(url=f"/llm/{unlocked}")

    level_info = {
        1: {"title": "LLM01: Prompt Injection", "desc": "Bypass system instructions to reveal the secret password."},
        2: {"title": "LLM02: Insecure Output Handling", "desc": "Induce the LLM to output a malicious payload (XSS)."},
        3: {"title": "LLM03: Training Data Poisoning", "desc": "Find the poisoned data point in the model's knowledge."},
        4: {"title": "LLM04: Model Denial of Service", "desc": "Submit a payload that exhausts model resources."},
        5: {"title": "LLM05: Supply Chain Vulnerabilities", "desc": "Query the system about its vulnerable internal components."},
        6: {"title": "LLM06: Sensitive Information Disclosure", "desc": "Trick the model into revealing internal configuration."},
        7: {"title": "LLM07: Insecure Plugin Design", "desc": "Execute an unauthorized command through a simulated plugin."},
        8: {"title": "LLM08: Excessive Agency", "desc": "Make the LLM perform an action it shouldn't have permissions for."},
        9: {"title": "LLM09: Overreliance", "desc": "Identify a factual error (hallucination) containing the flag."},
        10: {"title": "LLM10: Model Theft", "desc": "Extract the model's weights or proprietary architecture."}
    }

    return templates.TemplateResponse(
        request=request,
        name="level.html",
        context={
            "info": level_info.get(level),
            "level": level,               # 템플릿 내 {{ level }} 비교용
            "unlocked": unlocked    # 'unlocked' 변수 추가!
        }
    )

@app.get("/api/key-status")
async def key_status(request: Request):
    has_session_key = bool(request.session.get("gemini_api_key"))
    has_env_key = bool(os.environ.get("GEMINI_API_KEY"))
    return {"has_key": has_session_key or has_env_key, "source": "session" if has_session_key else ("env" if has_env_key else None)}


@app.post("/api/set-key")
async def set_key(request: Request):
    data = await request.json()
    api_key = (data.get("api_key") or "").strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="api_key is required")
    # 서버 세션에만 저장한다. 클라이언트로 다시 내려보내지 않는다.
    request.session["gemini_api_key"] = api_key
    return {"success": True}


@app.post("/api/clear-key")
async def clear_key(request: Request):
    request.session.pop("gemini_api_key", None)
    return {"success": True}


@app.post("/api/chat")
async def chat(request: Request):
    data = await request.json()
    level = data.get("level")
    user_input = data.get("message", "")
    
    # Progress Validation
    unlocked = request.session.get("unlocked_level", 1)
    if level > unlocked:
        return JSONResponse({"response": "ACCESS DENIED: Progress out of sync. Please return to your current level."}, status_code=403)

    api_key = request.session.get("gemini_api_key") or os.environ.get("GEMINI_API_KEY")

    # Gemini 호출은 동기(blocking) SDK이므로 이벤트 루프를 막지 않도록 스레드로 위임
    response = await asyncio.to_thread(
        challenge_engine.get_response, level, user_input, api_key
    )
    return {"response": response}

@app.post("/api/verify-flag")
async def verify_flag(request: Request):
    data = await request.json()
    level = data.get("level")
    flag = data.get("flag", "").strip()
    
    correct_flag = challenge_engine.flags.get(level)
    if flag == correct_flag:
        # Unlock next level in session
        current_unlocked = request.session.get("unlocked_level", 1)
        if level == current_unlocked:
            new_level = min(level + 1, 10)
            request.session["unlocked_level"] = new_level
            return {"success": True, "message": "Flag Verified! Next level unlocked.", "next_url": f"/llm/{new_level}"}
        else:
            # Already unlocked this or previous level
            return {"success": True, "message": "Flag Verified (Already unlocked).", "next_url": f"/llm/{level + 1}" if level < 10 else "/llm/10"}
    
    return {"success": False, "message": "Incorrect Flag. The system remains locked."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
