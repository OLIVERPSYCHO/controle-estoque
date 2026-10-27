import os
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from sqlalchemy.pool import NullPool, StaticPool


def agora():
    return datetime.now(timezone.utc)


def pegar_url_banco():
    url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
    if url:
        # o Neon manda "postgres://", mas o SQLAlchemy precisa saber o driver
        url = url.replace("postgres://", "postgresql://", 1)
        return url.replace("postgresql://", "postgresql+psycopg://", 1)

    # sem Postgres configurado usa SQLite (na Vercel só a pasta /tmp aceita escrita)
    if os.getenv("VERCEL"):
        return "sqlite:////tmp/estoque.db"
    return "sqlite:///estoque.db"


def criar_engine(url):
    if url == "sqlite://":
        # banco em memória dos testes
        return create_engine(url, connect_args={"check_same_thread": False}, poolclass=StaticPool)
    if url.startswith("sqlite"):
        return create_engine(url, connect_args={"check_same_thread": False})
    return create_engine(url, poolclass=NullPool)


class Base(DeclarativeBase):
    pass


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)


class Produto(Base):
    __tablename__ = "produtos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True)
    sku: Mapped[str] = mapped_column(String(40))
    nome: Mapped[str] = mapped_column(String(120))
    categoria: Mapped[str] = mapped_column(String(60))
    unidade: Mapped[str] = mapped_column(String(10), default="un")
    estoque_minimo: Mapped[int] = mapped_column(Integer, default=0)
    custo_unitario: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)


class Movimentacao(Base):
    __tablename__ = "movimentacoes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True)
    produto_id: Mapped[int] = mapped_column(ForeignKey("produtos.id"), index=True)
    tipo: Mapped[str] = mapped_column(String(10))  # entrada ou saida
    quantidade: Mapped[int] = mapped_column(Integer)
    observacao: Mapped[str] = mapped_column(String(200), default="")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora, index=True)


engine = criar_engine(pegar_url_banco())
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def configurar_banco(url=None):
    global engine
    if url:
        engine = criar_engine(url)
        SessionLocal.configure(bind=engine)
    Base.metadata.create_all(engine)


def get_session():
    with SessionLocal() as session:
        yield session
