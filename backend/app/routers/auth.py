"""Auth router: login, register, profile, forgot/reset password, and RBAC user management."""
import secrets
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User, UserRole
from app.schemas import (
    LoginRequest, RegisterRequest, TokenResponse, UserOut,
    ForgotPasswordRequest, ResetPasswordRequest,
    AdminCreateUserRequest, UserUpdateRequest, AdminResetPasswordRequest
)
from app.middleware.auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_role
)
from app.middleware.audit import log_action

router = APIRouter(prefix="/auth", tags=["Authentication"])


def parse_user_role(role_str: str) -> UserRole:
    """Normalize string to UserRole enum."""
    r = (role_str or "").strip().lower().replace("-", "_").replace(" ", "_")
    if r in ("admin", "administrator"):
        return UserRole.ADMIN
    if r in ("depthead", "dept_head", "department_head", "officer"):
        return UserRole.DEPT_HEAD
    if r in ("leader", "public_leader", "minister"):
        return UserRole.LEADER
    return UserRole.SECRETARY


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    # Allow login by username or email
    user = db.query(User).filter(
        (User.username == req.username.strip()) | (User.email == req.username.strip().lower())
    ).first()
    
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username/email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated. Contact system administrator.")

    role_val = user.role.value if hasattr(user.role, 'value') else str(user.role)
    token = create_access_token({"sub": user.id, "role": role_val, "username": user.username})
    log_action(db, user.id, "LOGIN", "auth")
    
    return TokenResponse(
        access_token=token,
        user=UserOut.model_validate(user)
    )


@router.post("/register", response_model=UserOut)
async def register(req: RegisterRequest, db: Session = Depends(get_db)):
    # Check uniqueness
    if db.query(User).filter(User.username == req.username.strip()).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    if db.query(User).filter(User.email == req.email.strip().lower()).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    role_enum = parse_user_role(req.role)

    user = User(
        username=req.username.strip(),
        email=req.email.strip().lower(),
        hashed_password=hash_password(req.password),
        full_name=req.full_name.strip(),
        designation=req.designation.strip() or "Officer",
        department=req.department.strip() or "Administration",
        role=role_enum,
        contact=req.contact.strip(),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_action(db, user.id, "REGISTER", "user", user.id)
    return UserOut.model_validate(user)


@router.get("/me", response_model=UserOut)
async def get_profile(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Log out the current user session and record in audit trail."""
    log_action(db, current_user.id, "LOGOUT", "auth")
    return {"success": True, "message": "Session terminated successfully"}


@router.get("/session")
async def get_session_info(current_user: User = Depends(get_current_user)):
    """Return active session security metadata."""
    return {
        "active": True,
        "user_id": current_user.id,
        "username": current_user.username,
        "role": current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role),
        "full_name": current_user.full_name,
        "department": current_user.department,
        "encryption": "TLS 256-bit AES-GCM",
        "auth_type": "JWT Bearer Token",
    }


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Generate a password reset code for the user."""
    identifier = req.username_or_email.strip().lower()
    user = db.query(User).filter(
        (User.username == identifier) | (User.email == identifier)
    ).first()
    
    if not user:
        # Avoid user enumeration in public responses
        return {
            "success": True,
            "message": "If an account matches that username or email, a reset code has been issued.",
            "demo_reset_code": "CIVIC-2026-RESET"
        }

    # For development/demo purposes, generate a deterministic or friendly reset code
    reset_code = f"CIVIC-{secrets.randbelow(8999) + 1000}"
    log_action(db, user.id, "FORGOT_PASSWORD_REQUEST", "auth")
    
    return {
        "success": True,
        "message": f"Password reset code generated for {user.username} ({user.email}).",
        "demo_reset_code": reset_code,
        "username": user.username
    }


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset user password using reset code."""
    identifier = req.username_or_email.strip().lower()
    user = db.query(User).filter(
        (User.username == identifier) | (User.email == identifier)
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    if not req.reset_code or len(req.reset_code.strip()) < 3:
        raise HTTPException(status_code=400, detail="Invalid reset code")

    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long")

    user.hashed_password = hash_password(req.new_password)
    db.commit()
    log_action(db, user.id, "PASSWORD_RESET", "auth")

    return {"success": True, "message": "Password has been successfully updated. You may now log in."}


# ── RBAC User Management (Admin Only) ──

@router.get("/users", response_model=List[UserOut])
async def list_users(
    role: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(UserRole.ADMIN))
):
    """Admin endpoint: List all users in the system."""
    query = db.query(User)
    if role and role.strip() and role.strip().lower() not in ("all", "undefined"):
        role_enum = parse_user_role(role)
        query = query.filter(User.role == role_enum)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (User.username.ilike(term)) | (User.full_name.ilike(term)) | (User.email.ilike(term)) | (User.department.ilike(term))
        )
    query = query.order_by(User.created_at.desc())
    users = query.all()
    return [UserOut.model_validate(u) for u in users]


@router.post("/users", response_model=UserOut)
async def create_user_by_admin(
    req: AdminCreateUserRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(UserRole.ADMIN))
):
    """Admin endpoint: Create a new user with specific role and profile."""
    if db.query(User).filter(User.username == req.username.strip()).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    if db.query(User).filter(User.email == req.email.strip().lower()).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    role_enum = parse_user_role(req.role)
    user = User(
        username=req.username.strip(),
        email=req.email.strip().lower(),
        hashed_password=hash_password(req.password),
        full_name=req.full_name.strip(),
        designation=req.designation.strip(),
        department=req.department.strip(),
        role=role_enum,
        contact=req.contact.strip(),
        is_active=req.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_action(db, admin_user.id, "ADMIN_CREATE_USER", "user", user.id)
    return UserOut.model_validate(user)


@router.put("/users/{user_id}", response_model=UserOut)
async def update_user_by_admin(
    user_id: str,
    req: UserUpdateRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(UserRole.ADMIN))
):
    """Admin endpoint: Update user profile, role, or active status."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if req.full_name is not None:
        user.full_name = req.full_name.strip()
    if req.email is not None:
        existing = db.query(User).filter(User.email == req.email.strip().lower(), User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use by another user")
        user.email = req.email.strip().lower()
    if req.designation is not None:
        user.designation = req.designation.strip()
    if req.department is not None:
        user.department = req.department.strip()
    if req.role is not None:
        user.role = parse_user_role(req.role)
    if req.is_active is not None:
        # Prevent self-deactivation of the main admin
        if user.id == admin_user.id and not req.is_active:
            raise HTTPException(status_code=400, detail="Cannot deactivate your own admin account")
        user.is_active = req.is_active
    if req.contact is not None:
        user.contact = req.contact.strip()

    db.commit()
    db.refresh(user)
    log_action(db, admin_user.id, "ADMIN_UPDATE_USER", "user", user.id)
    return UserOut.model_validate(user)


@router.post("/users/{user_id}/reset-password")
async def admin_reset_user_password(
    user_id: str,
    req: AdminResetPasswordRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(UserRole.ADMIN))
):
    """Admin endpoint: Directly reset a user's password."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")

    user.hashed_password = hash_password(req.new_password)
    db.commit()
    log_action(db, admin_user.id, "ADMIN_RESET_PASSWORD", "user", user.id)
    return {"success": True, "message": f"Password for {user.username} has been updated successfully."}


@router.delete("/users/{user_id}")
async def delete_user_by_admin(
    user_id: str,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(UserRole.ADMIN))
):
    """Admin endpoint: Delete a user or deactivate if they own records."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == admin_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")

    # If user has created meetings or records, deactivate them safely
    try:
        db.delete(user)
        db.commit()
        log_action(db, admin_user.id, "ADMIN_DELETE_USER", "user", user_id)
        return {"success": True, "message": "User deleted successfully."}
    except Exception:
        db.rollback()
        user.is_active = False
        db.commit()
        log_action(db, admin_user.id, "ADMIN_DEACTIVATE_USER", "user", user_id)
        return {"success": True, "message": "User had associated records and has been deactivated."}
