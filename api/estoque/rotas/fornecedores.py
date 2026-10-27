from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import Fornecedor, Pedido, Produto, get_session
from ..estoque import buscar, pegar_workspace
from ..schemas import FornecedorEntrada, FornecedorSaida

router = APIRouter(prefix="/api")


def montar(fornecedor, total_produtos=0):
    return {
        "id": fornecedor.id,
        "nome": fornecedor.nome,
        "cnpj": fornecedor.cnpj,
        "telefone": fornecedor.telefone,
        "email": fornecedor.email,
        "cidade": fornecedor.cidade,
        "prazo_entrega_dias": fornecedor.prazo_entrega_dias,
        "total_produtos": total_produtos,
    }


@router.get("/fornecedores", response_model=list[FornecedorSaida])
def listar_fornecedores(workspace_id: str = Depends(pegar_workspace), session: Session = Depends(get_session)):
    contagem = dict(session.execute(
        select(Produto.fornecedor_id, func.count())
        .where(Produto.workspace_id == workspace_id)
        .group_by(Produto.fornecedor_id)
    ).all())
    fornecedores = session.scalars(
        select(Fornecedor).where(Fornecedor.workspace_id == workspace_id).order_by(Fornecedor.nome)
    )
    return [montar(f, contagem.get(f.id, 0)) for f in fornecedores]


@router.post("/fornecedores", status_code=201, response_model=FornecedorSaida)
def criar_fornecedor(dados: FornecedorEntrada, workspace_id: str = Depends(pegar_workspace),
                     session: Session = Depends(get_session)):
    fornecedor = Fornecedor(workspace_id=workspace_id, **dados.model_dump())
    session.add(fornecedor)
    session.commit()
    return montar(fornecedor)


@router.put("/fornecedores/{fornecedor_id}", response_model=FornecedorSaida)
def editar_fornecedor(fornecedor_id: int, dados: FornecedorEntrada, workspace_id: str = Depends(pegar_workspace),
                      session: Session = Depends(get_session)):
    fornecedor = buscar(session, Fornecedor, fornecedor_id, workspace_id, "Fornecedor")
    for campo, valor in dados.model_dump().items():
        setattr(fornecedor, campo, valor)
    session.commit()
    return montar(fornecedor)


@router.delete("/fornecedores/{fornecedor_id}", status_code=204)
def excluir_fornecedor(fornecedor_id: int, workspace_id: str = Depends(pegar_workspace),
                       session: Session = Depends(get_session)):
    fornecedor = buscar(session, Fornecedor, fornecedor_id, workspace_id, "Fornecedor")
    if session.scalar(select(Pedido.id).where(Pedido.fornecedor_id == fornecedor.id)):
        raise HTTPException(409, "Esse fornecedor tem pedidos de compra e não pode ser excluído")

    # os produtos dele ficam sem fornecedor
    for produto in session.scalars(select(Produto).where(Produto.fornecedor_id == fornecedor.id)):
        produto.fornecedor_id = None
    session.delete(fornecedor)
    session.commit()
    return Response(status_code=204)
