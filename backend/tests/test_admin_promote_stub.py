import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base, get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.security import hash_password
from app.models import User

DB_FILE = "test_promote.db"
if os.path.exists(DB_FILE):
    os.remove(DB_FILE)

# Isolated sqlite DB for this test; file removed each run to avoid UNIQUE conflicts
engine = create_engine(f"sqlite:///./{DB_FILE}", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def create_user(email: str):
    db = TestingSessionLocal()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        db.close()
        return existing
    user = User(email=email, hashed_password=hash_password("pass123"))
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def get_token(email: str):
    resp = client.post("/auth/login", json={"email": email, "password": "pass123"})
    assert resp.status_code == 200
    return resp.json()["access_token"]


def test_promote_stub_returns_501():
    email = "stub@example.com"
    create_user(email)
    token = get_token(email)
    resp = client.post(f"/auth/promote/1", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 501
    assert "not implemented" in resp.json()["detail"].lower() or "не реализовано" in resp.json()["detail"].lower()
