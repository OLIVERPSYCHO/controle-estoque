from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import analise
from ..db import Filial, Fornecedor, Movimentacao, Pedido, PedidoItem, Produto, get_session
from ..estoque import buscar, hoje_brasilia, para_utc, pegar_workspace, registrar_entrada, saldos_por_produto
from ..schemas import PedidoEntrada, PedidoSaida, Recebimento

router = APIRouter(prefix="/api")


def montar_pedido(session, pedido):
    fornecedor = session.get(Fornecedor, pedido.fornecedor_id)
    filial = session.get(Filial, pedido.filial_id)
    itens = []
    for item, produto in session.execute(
        select(PedidoItem, Produto).join(Produto, Produto.id == PedidoItem.produto_id)
        .where(PedidoItem.pedido_id == pedido.id).order_by(Produto.nome)
    ):
        itens.append({
            "id": item.id,
            "produto_id": produto.id,
            "produto_nome": produto.nome,
            "produto_ean": produto.ean,
            "qtd_por_fardo": produto.qtd_por_fardo,
            "validade_dias": produto.validade_dias,
            "quantidade": item.quantidade,
            "custo": float(item.custo),
        })
    return {
        "id": pedido.id,
        "fornecedor_id": pedido.fornecedor_id,
        "fornecedor_nome": fornecedor.nome,
        "filial_id": pedido.filial_id,
        "filial_nome": filial.nome,
        "status": pedido.status,
        "observacao": pedido.observacao,
        "criado_em": para_utc(pedido.criado_em),
        "recebido_em": para_utc(pedido.recebido_em),
        "total": round(sum(i["quantidade"] * i["custo"] for i in itens), 2),
        "itens": itens,
    }


@router.get("/compras/sugestao")
def sugestao_compra(filial_id: int, workspace_id: str = Depends(pegar_workspace),
                    session: Session = Depends(get_session)):
    """Sugere o que comprar por fornecedor, olhando o consumo dos últimos 30 dias da filial."""
    buscar(session, Filial, filial_id, workspace_id, "Filial")
    saldos = saldos_por_produto(session, workspace_id, filial_id)

    # o que já foi pedido e ainda não chegou conta como estoque
    a_caminho = {}
    pedidos_abertos = session.execute(
        select(PedidoItem.produto_id, PedidoItem.quantidade)
        .join(Pedido, Pedido.id == PedidoItem.pedido_id)
        .where(Pedido.workspace_id == workspace_id, Pedido.filial_id == filial_id, Pedido.status == "aberto")
    )
    for produto_id, quantidade in pedidos_abertos:
        a_caminho[produto_id] = a_caminho.get(produto_id, 0) + quantidade

    desde = datetime.now(timezone.utc) - timedelta(days=30)
    vendas = {}
    for produto_id, quantidade in session.execute(
        select(Movimentacao.produto_id, Movimentacao.quantidade).where(
            Movimentacao.workspace_id == workspace_id, Movimentacao.filial_id == filial_id,
            Movimentacao.tipo == "saida", Movimentacao.motivo == "venda", Movimentacao.criado_em >= desde,
        )
    ):
        vendas[produto_id] = vendas.get(produto_id, 0) + quantidade

    fornecedores = {f.id: f for f in session.scalars(select(Fornecedor).where(Fornecedor.workspace_id == workspace_id))}
    grupos = {}
    for produto in session.scalars(select(Produto).where(Produto.workspace_id == workspace_id).order_by(Produto.nome)):
        fornecedor = fornecedores.get(produto.fornecedor_id)
        if fornecedor is None:
            continue
        saldo = saldos.get(produto.id, 0)
        consumo = analise.consumo_medio_diario(vendas.get(produto.id, 0), 30)
        quantidade = analise.sugestao_de_compra(
            saldo + a_caminho.get(produto.id, 0), consumo, produto.estoque_minimo,
            fornecedor.prazo_entrega_dias, produto.qtd_por_fardo,
        )
        if quantidade <= 0:
            continue

        grupo = grupos.setdefault(fornecedor.id, {
            "fornecedor_id": fornecedor.id,
            "fornecedor_nome": fornecedor.nome,
            "prazo_entrega_dias": fornecedor.prazo_entrega_dias,
            "itens": [],
        })
        cobertura = analise.dias_de_cobertura(saldo, consumo)
        grupo["itens"].append({
            "produto_id": produto.id,
            "produto_nome": produto.nome,
            "produto_ean": produto.ean,
            "saldo": saldo,
            "a_caminho": a_caminho.get(produto.id, 0),
            "consumo_diario": round(consumo, 1),
            "dias_de_cobertura": round(cobertura, 1) if cobertura is not None else None,
            "qtd_por_fardo": produto.qtd_por_fardo,
            "quantidade": quantidade,
            "custo": float(produto.custo),
        })
    return list(grupos.values())


@router.get("/pedidos", response_model=list[PedidoSaida])
def listar_pedidos(filial_id: int | None = None, status: str = "", workspace_id: str = Depends(pegar_workspace),
                   session: Session = Depends(get_session)):
    consulta = select(Pedido).where(Pedido.workspace_id == workspace_id).order_by(Pedido.criado_em.desc())
    if filial_id:
        consulta = consulta.where(Pedido.filial_id == filial_id)
    if status:
        consulta = consulta.where(Pedido.status == status)
    return [montar_pedido(session, p) for p in session.scalars(consulta)]


@router.post("/pedidos", status_code=201, response_model=PedidoSaida)
def criar_pedido(dados: PedidoEntrada, workspace_id: str = Depends(pegar_workspace),
                 session: Session = Depends(get_session)):
    buscar(session, Fornecedor, dados.fornecedor_id, workspace_id, "Fornecedor")
    buscar(session, Filial, dados.filial_id, workspace_id, "Filial")

    pedido = Pedido(workspace_id=workspace_id, fornecedor_id=dados.fornecedor_id, filial_id=dados.filial_id,
                    observacao=dados.observacao)
    session.add(pedido)
    session.flush()
    for item in dados.itens:
        buscar(session, Produto, item.produto_id, workspace_id, "Produto")
        session.add(PedidoItem(pedido_id=pedido.id, produto_id=item.produto_id, quantidade=item.quantidade,
                               custo=item.custo))
    session.commit()
    return montar_pedido(session, pedido)


@router.post("/pedidos/{pedido_id}/receber", response_model=PedidoSaida)
def receber_pedido(pedido_id: int, dados: Recebimento, workspace_id: str = Depends(pegar_workspace),
                   session: Session = Depends(get_session)):
    """Dá entrada no estoque de todos os itens do pedido, com o lote e a validade informados."""
    pedido = buscar(session, Pedido, pedido_id, workspace_id, "Pedido")
    if pedido.status != "aberto":
        raise HTTPException(409, "Esse pedido já foi recebido ou cancelado")

    informados = {i.item_id: i for i in dados.itens}
    hoje = hoje_brasilia()
    for item in session.scalars(select(PedidoItem).where(PedidoItem.pedido_id == pedido.id)):
        produto = session.get(Produto, item.produto_id)
        info = informados.get(item.id)
        lote = info.lote_codigo.strip() if info and info.lote_codigo.strip() else f"P{pedido.id}"
        validade = info.validade if info and info.validade else None
        if validade is None and produto.validade_dias:
            # se não informou, usa a validade padrão do produto
            validade = hoje + timedelta(days=produto.validade_dias)

        registrar_entrada(session, workspace_id, produto, pedido.filial_id, item.quantidade, "compra",
                          lote, validade, f"Pedido de compra #{pedido.id}")
        # atualiza o custo do produto com o último preço pago
        produto.custo = item.custo

    pedido.status = "recebido"
    pedido.recebido_em = datetime.now(timezone.utc)
    session.commit()
    return montar_pedido(session, pedido)


@router.post("/pedidos/{pedido_id}/cancelar", response_model=PedidoSaida)
def cancelar_pedido(pedido_id: int, workspace_id: str = Depends(pegar_workspace),
                    session: Session = Depends(get_session)):
    pedido = buscar(session, Pedido, pedido_id, workspace_id, "Pedido")
    if pedido.status != "aberto":
        raise HTTPException(409, "Só dá para cancelar pedido em aberto")
    pedido.status = "cancelado"
    session.commit()
    return montar_pedido(session, pedido)
