import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from . import db
from .db import Filial, Fornecedor, Lote, Movimentacao, Pedido, PedidoItem, Produto, Workspace, get_session
from .demo import criar_dados_demo
from .estoque import pegar_workspace
from .rotas import compras, fornecedores, movimentacoes, painel, produtos

app = FastAPI(title="Controle de Estoque - Atacado", docs_url="/api/docs", openapi_url="/api/openapi.json")
db.configurar_banco()

app.include_router(produtos.router)
app.include_router(movimentacoes.router)
app.include_router(fornecedores.router)
app.include_router(compras.router)
app.include_router(painel.router)


def apagar_dados(session, workspace_id):
    pedidos = select(Pedido.id).where(Pedido.workspace_id == workspace_id)
    session.execute(delete(PedidoItem).where(PedidoItem.pedido_id.in_(pedidos)))
    session.execute(delete(Pedido).where(Pedido.workspace_id == workspace_id))
    session.execute(delete(Movimentacao).where(Movimentacao.workspace_id == workspace_id))
    session.execute(delete(Lote).where(Lote.workspace_id == workspace_id))
    session.execute(delete(Produto).where(Produto.workspace_id == workspace_id))
    session.execute(delete(Fornecedor).where(Fornecedor.workspace_id == workspace_id))
    session.execute(delete(Filial).where(Filial.workspace_id == workspace_id))


@app.get("/api/saude")
def saude():
    return {"status": "ok"}


# Cada visitante ganha um espaço próprio já com dados de exemplo
@app.post("/api/workspaces", status_code=201)
def criar_workspace(session: Session = Depends(get_session)):
    # apaga os espaços com mais de 14 dias para o banco não crescer
    limite = datetime.now(timezone.utc) - timedelta(days=14)
    for antigo_id in session.scalars(select(Workspace.id).where(Workspace.criado_em < limite)).all():
        apagar_dados(session, antigo_id)
        session.execute(delete(Workspace).where(Workspace.id == antigo_id))

    workspace = Workspace(id=str(uuid.uuid4()))
    session.add(workspace)
    session.flush()
    criar_dados_demo(session, workspace.id)
    session.commit()
    return {"id": workspace.id}


@app.post("/api/workspaces/restaurar")
def restaurar_workspace(workspace_id: str = Depends(pegar_workspace), session: Session = Depends(get_session)):
    apagar_dados(session, workspace_id)
    criar_dados_demo(session, workspace_id)
    session.commit()
    return {"id": workspace_id}
