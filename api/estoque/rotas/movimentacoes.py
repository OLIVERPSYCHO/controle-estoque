from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import analise
from ..db import Filial, Lote, Movimentacao, Produto, get_session
from ..estoque import (
    buscar, hoje_brasilia, nomes_filiais, para_utc, pegar_workspace, registrar_entrada,
    registrar_saida, saldos_por_lote,
)
from ..schemas import MovimentacaoEntrada, MovimentacaoSaida

router = APIRouter(prefix="/api")

MOTIVOS_ENTRADA = {"compra", "devolucao", "ajuste"}
MOTIVOS_SAIDA = {"venda", "perda", "avaria", "uso_interno", "ajuste"}


@router.get("/movimentacoes", response_model=list[MovimentacaoSaida])
def listar_movimentacoes(
    tipo: str = "",
    produto_id: int | None = None,
    filial_id: int | None = None,
    limite: int = 100,
    workspace_id: str = Depends(pegar_workspace),
    session: Session = Depends(get_session),
):
    consulta = (
        select(Movimentacao, Produto, Lote.codigo)
        .join(Produto, Produto.id == Movimentacao.produto_id)
        .join(Lote, Lote.id == Movimentacao.lote_id)
        .where(Movimentacao.workspace_id == workspace_id)
        .order_by(Movimentacao.criado_em.desc(), Movimentacao.id.desc())
        .limit(min(limite, 300))
    )
    if tipo:
        consulta = consulta.where(Movimentacao.tipo == tipo)
    if produto_id:
        consulta = consulta.where(Movimentacao.produto_id == produto_id)
    if filial_id:
        consulta = consulta.where(Movimentacao.filial_id == filial_id)

    filiais = nomes_filiais(session, workspace_id)
    return [
        {
            "id": m.id, "produto_id": p.id, "produto_nome": p.nome, "produto_ean": p.ean,
            "filial_nome": filiais[m.filial_id], "lote_codigo": codigo, "tipo": m.tipo, "motivo": m.motivo,
            "quantidade": m.quantidade, "observacao": m.observacao, "criado_em": para_utc(m.criado_em),
        }
        for m, p, codigo in session.execute(consulta)
    ]


@router.post("/movimentacoes", status_code=201, response_model=list[MovimentacaoSaida])
def registrar_movimentacao(dados: MovimentacaoEntrada, workspace_id: str = Depends(pegar_workspace),
                           session: Session = Depends(get_session)):
    produto = buscar(session, Produto, dados.produto_id, workspace_id, "Produto")
    filial = buscar(session, Filial, dados.filial_id, workspace_id, "Filial")

    if dados.tipo == "entrada":
        if dados.motivo not in MOTIVOS_ENTRADA:
            raise HTTPException(422, "Motivo inválido para entrada")
        movs = registrar_entrada(session, workspace_id, produto, filial.id, dados.quantidade, dados.motivo,
                                 dados.lote_codigo.strip(), dados.validade, dados.observacao)
    else:
        if dados.motivo not in MOTIVOS_SAIDA:
            raise HTTPException(422, "Motivo inválido para saída")
        movs = registrar_saida(session, workspace_id, produto, filial.id, dados.quantidade, dados.motivo,
                               dados.observacao, dados.lote_id)
    session.commit()

    lotes = {l.id: l.codigo for l in session.scalars(select(Lote).where(Lote.id.in_([m.lote_id for m in movs])))}
    return [
        {
            "id": m.id, "produto_id": produto.id, "produto_nome": produto.nome, "produto_ean": produto.ean,
            "filial_nome": filial.nome, "lote_codigo": lotes[m.lote_id], "tipo": m.tipo, "motivo": m.motivo,
            "quantidade": m.quantidade, "observacao": m.observacao, "criado_em": para_utc(m.criado_em),
        }
        for m in movs
    ]


@router.get("/validades")
def listar_validades(
    dias: int = 60,
    filial_id: int | None = None,
    workspace_id: str = Depends(pegar_workspace),
    session: Session = Depends(get_session),
):
    """Lotes com saldo que já venceram ou vencem nos próximos `dias` dias."""
    hoje = hoje_brasilia()
    saldos = saldos_por_lote(session, workspace_id, filial_id)
    filiais = nomes_filiais(session, workspace_id)

    consulta = (
        select(Lote, Produto)
        .join(Produto, Produto.id == Lote.produto_id)
        .where(Lote.workspace_id == workspace_id, Lote.validade.is_not(None))
        .order_by(Lote.validade)
    )
    if filial_id:
        consulta = consulta.where(Lote.filial_id == filial_id)

    resultado = []
    for lote, produto in session.execute(consulta):
        saldo = saldos.get(lote.id, 0)
        if saldo <= 0 or (lote.validade - hoje).days > dias:
            continue
        resultado.append({
            "lote_id": lote.id,
            "lote_codigo": lote.codigo,
            "validade": lote.validade,
            "dias_para_vencer": (lote.validade - hoje).days,
            "situacao": analise.situacao_validade(lote.validade, hoje),
            "saldo": saldo,
            "valor": round(saldo * float(produto.custo), 2),
            "filial_id": lote.filial_id,
            "filial_nome": filiais[lote.filial_id],
            "produto_id": produto.id,
            "produto_nome": produto.nome,
            "produto_ean": produto.ean,
            "tem_imagem": bool(produto.imagem_tipo),
            "imagem_url": produto.imagem_url,
        })
    return resultado
