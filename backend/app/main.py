import os
import warnings
warnings.filterwarnings("ignore", category=UserWarning, module="pypdf")
try:
    from cryptography.utils import CryptographyDeprecationWarning
    warnings.filterwarnings("ignore", category=CryptographyDeprecationWarning)
except ImportError:
    pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db

# ── Create app ──
app = FastAPI(
    title=settings.app_name,
    description="AI Meeting Summarization Co-Pilot for Public Leaders & Administrators",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──
origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers ──
from app.routers import auth, meetings, transcription, summary, actions, chat, export, documents

app.include_router(auth.router)
app.include_router(meetings.router)
app.include_router(transcription.router)
app.include_router(summary.router)
app.include_router(actions.router)
app.include_router(chat.router)
app.include_router(export.router)
app.include_router(documents.router)


# ── Startup ──
@app.on_event("startup")
async def on_startup():
    # Create tables
    init_db()
    # Create upload directory
    os.makedirs(settings.upload_dir, exist_ok=True)
    # Create default admin user if none exists
    _create_default_user()


def _create_default_user():
    """Create default system users for all RBAC roles on first-time setup."""
    from app.database import SessionLocal
    from app.models.models import User, UserRole
    from app.middleware.auth import hash_password

    db = SessionLocal()
    try:
        default_users = [
            {
                "username": "admin",
                "email": "admin@gov.in",
                "password": "admin123",
                "full_name": "System Administrator",
                "designation": "Chief IT Administrator",
                "department": "Directorate of IT",
                "role": UserRole.ADMIN,
            },
            {
                "username": "depthead",
                "email": "depthead@gov.in",
                "password": "password123",
                "full_name": "Dr. Rajesh Verma",
                "designation": "Head of Department",
                "department": "Public Works & Finance",
                "role": UserRole.DEPT_HEAD,
            },
            {
                "username": "secretary",
                "email": "secretary@gov.in",
                "password": "password123",
                "full_name": "Ananya Deshmukh",
                "designation": "Principal Secretary",
                "department": "General Administration",
                "role": UserRole.SECRETARY,
            },
            {
                "username": "leader",
                "email": "leader@gov.in",
                "password": "password123",
                "full_name": "Hon. Public Leader",
                "designation": "State Representative / Minister",
                "department": "Executive Council",
                "role": UserRole.LEADER,
            },
        ]

        for u in default_users:
            existing = db.query(User).filter((User.username == u["username"]) | (User.email == u["email"])).first()
            if not existing:
                new_user = User(
                    username=u["username"],
                    email=u["email"],
                    hashed_password=hash_password(u["password"]),
                    full_name=u["full_name"],
                    designation=u["designation"],
                    department=u["department"],
                    role=u["role"],
                    is_active=True,
                )
                db.add(new_user)
                db.commit()
                print(f"✅ Created default user: {u['username']} ({u['role'].value})")
            else:
                # Ensure the existing admin has ADMIN role
                if u["username"] == "admin" and existing.role != UserRole.ADMIN:
                    existing.role = UserRole.ADMIN
                    existing.hashed_password = hash_password(u["password"])
                    db.commit()
                    print("✅ Updated admin account role to ADMIN")
    finally:
        db.close()


# ── Health check ──
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.app_name,
        "env": settings.app_env,
    }


@app.get("/")
async def root():
    return {
        "message": "🏛️ AI Meeting Co-Pilot API",
        "docs": "/docs",
        "health": "/health",
    }
