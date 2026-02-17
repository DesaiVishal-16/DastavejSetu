# Auth endpoints
from fastapi import APIRouter, HTTPException, Response, Request
from pydantic import BaseModel
import uuid

router = APIRouter()

# Simple in-memory session storage (use Redis/database in production)
_sessions = {}

# Cookie name
SESSION_COOKIE_NAME = "udayam.session_token"


class LoginRequest(BaseModel):
    email: str


class SignupRequest(BaseModel):
    email: str
    name: str


class SessionResponse(BaseModel):
    success: bool
    data: dict | None = None


def create_session_token():
    """Create a simple session token"""
    return str(uuid.uuid4())


@router.post("/signup")
async def signup(request: SignupRequest, response: Response):
    """Simple signup - creates a user session"""
    user_id = request.email.split("@")[0]
    session_token = create_session_token()

    _sessions[session_token] = {
        "user": {
            "id": user_id,
            "email": request.email,
            "name": request.name,
        }
    }

    # Set cookie
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        max_age=60 * 60 * 24 * 7,  # 7 days
        samesite="lax",
    )

    return {
        "success": True,
        "message": "User created successfully",
        "user": {
            "id": user_id,
            "email": request.email,
            "name": request.name,
        },
    }


@router.post("/login")
async def login(request: LoginRequest, response: Response):
    """Simple login - creates a user session"""
    user_id = request.email.split("@")[0]
    session_token = create_session_token()

    _sessions[session_token] = {
        "user": {
            "id": user_id,
            "email": request.email,
            "name": request.email.split("@")[0],
        }
    }

    # Set cookie
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        max_age=60 * 60 * 24 * 7,  # 7 days
        samesite="lax",
    )

    return {
        "success": True,
        "message": "Login successful",
        "user": {
            "id": user_id,
            "email": request.email,
            "name": request.email.split("@")[0],
        },
    }


@router.get("/session")
async def get_session(request: Request):
    """Get current session"""
    # Check for session token in cookie
    session_token = request.cookies.get(SESSION_COOKIE_NAME)

    if session_token and session_token in _sessions:
        user_data = _sessions[session_token]
        return {
            "success": True,
            "data": user_data,
        }

    return {
        "success": False,
        "data": None,
    }


@router.post("/sign-out")
async def sign_out(response: Response):
    """Sign out - clears the session"""
    response.delete_cookie(SESSION_COOKIE_NAME)
    return {
        "success": True,
        "message": "Signed out successfully",
    }
