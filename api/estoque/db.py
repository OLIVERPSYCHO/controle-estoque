import os
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Integer, LargeBinary, Numeric, String, Text, create_engine, inspect
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


class Filial(Base):
    __tablename__ = "filiais"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True)
    nome: Mapped[str] = mapped_column(String(80))


class Fornecedor(Base):
    __tablename__ = "fornecedores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True)
    nome: Mapped[str] = mapped_column(String(120))
    cnpj: Mapped[str] = mapped_column(String(20), default="")
    telefone: Mapped[str] = mapped_column(String(20), default="")
    email: Mapped[str] = mapped_column(String(120), default="")
    cidade: Mapped[str] = mapped_column(String(80), default="")
    prazo_entrega_dias: Mapped[int] = mapped_column(Integer, default=7)


class Produto(Base):
    __tablename__ = "produtos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True)
    ean: Mapped[str] = mapped_column(String(14), default="")
    nome: Mapped[str] = mapped_column(String(150))
    marca: Mapped[str] = mapped_column(String(80), default="")
    categoria: Mapped[str] = mapped_column(String(60))
    descricao: Mapped[str] = mapped_column(Text, default="")
    peso: Mapped[str] = mapped_column(String(30), default="")  # ex.: "5 kg", "2 L"
    qtd_por_fardo: Mapped[int] = mapped_column(Integer, default=1)
    validade_dias: Mapped[int] = mapped_column(Integer, default=0)  # validade do produto depois de fabricado
    custo: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    preco_varejo: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    preco_atacado: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    qtd_minima_atacado: Mapped[int] = mapped_column(Integer, default=1)
    estoque_minimo: Mapped[int] = mapped_column(Integer, default=0)
    fornecedor_id: Mapped[int | None] = mapped_column(ForeignKey("fornecedores.id"), nullable=True)
    imagem_url: Mapped[str] = mapped_column(String(300), default="")
    imagem: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True, deferred=True)
    imagem_tipo: Mapped[str] = mapped_column(String(30), default="")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)


class Lote(Base):
    __tablename__ = "lotes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True)
    produto_id: Mapped[int] = mapped_column(ForeignKey("produtos.id"), index=True)
    filial_id: Mapped[int] = mapped_column(ForeignKey("filiais.id"), index=True)
    codigo: Mapped[str] = mapped_column(String(40))
    validade: Mapped[date | None] = mapped_column(Date, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)


class Movimentacao(Base):
    __tablename__ = "movimentacoes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True)
    produto_id: Mapped[int] = mapped_column(ForeignKey("produtos.id"), index=True)
    filial_id: Mapped[int] = mapped_column(ForeignKey("filiais.id"), index=True)
    lote_id: Mapped[int] = mapped_column(ForeignKey("lotes.id"), index=True)
    tipo: Mapped[str] = mapped_column(String(10))  # entrada ou saida
    motivo: Mapped[str] = mapped_column(String(20))  # compra, venda, perda, ajuste...
    quantidade: Mapped[int] = mapped_column(Integer)
    observacao: Mapped[str] = mapped_column(String(200), default="")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora, index=True)


class Pedido(Base):
    __tablename__ = "pedidos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True)
    fornecedor_id: Mapped[int] = mapped_column(ForeignKey("fornecedores.id"))
    filial_id: Mapped[int] = mapped_column(ForeignKey("filiais.id"))
    status: Mapped[str] = mapped_column(String(15), default="aberto")  # aberto, recebido, cancelado
    observacao: Mapped[str] = mapped_column(String(200), default="")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)
    recebido_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PedidoItem(Base):
    __tablename__ = "pedido_itens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pedido_id: Mapped[int] = mapped_column(ForeignKey("pedidos.id"), index=True)
    produto_id: Mapped[int] = mapped_column(ForeignKey("produtos.id"))
    quantidade: Mapped[int] = mapped_column(Integer)  # em unidades
    custo: Mapped[float] = mapped_column(Numeric(12, 2), default=0)


engine = criar_engine(pegar_url_banco())
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def configurar_banco(url=None):
    global engine
    if url:
        engine = criar_engine(url)
        SessionLocal.configure(bind=engine)

    # a primeira versão do projeto tinha outras tabelas; como são só dados de demonstração, recria tudo
    colunas = [c["name"] for c in inspect(engine).get_columns("produtos")] if inspect(engine).has_table("produtos") else []
    if colunas and "ean" not in colunas:
        Base.metadata.drop_all(engine)

    Base.metadata.create_all(engine)


def get_session():
    with SessionLocal() as session:
        yield session
