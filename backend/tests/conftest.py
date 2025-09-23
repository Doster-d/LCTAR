import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.models import (  # noqa: F401 ensure models imported
    character,
    log,
    user,
    video,
)

TEST_DB_URL = 'sqlite+pysqlite:///:memory:'


@pytest.fixture(scope='session', autouse=True)
def _setup_env():
    os.environ['ENABLE_INFERENCE'] = 'false'
    yield


@pytest.fixture()
def db_session():
    engine = create_engine(
        TEST_DB_URL,
        future=True,
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_maker = sessionmaker(
        bind=engine, autoflush=False, autocommit=False, future=True
    )
    session = session_maker()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)
