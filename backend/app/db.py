import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


def database_url():
    return os.environ.get("DATABASE_URL", "postgresql+psycopg://critix:critix@localhost:5432/critix")


engine = create_engine(database_url(), pool_pre_ping=True, pool_timeout=10,
                       connect_args={"connect_timeout": 5, "options": "-c statement_timeout=15000 -c lock_timeout=5000"})
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def session():
    with SessionLocal() as db:
        yield db
