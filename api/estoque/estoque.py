from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from . import analise
from .db import Filial, Lote, Movimentacao, Produto, Workspace, get_session

FUSO_BRASILIA = timezone(timedelta(hours=-3))


def hoje_brasilia():
    return datetime.now(FUSO_BRASILIA).date()


def para_utc(data):
    # o sqlite devolve a data sem fuso
    if data is not None and data.tzinfo is None:
        return data.replace(tzinfo=timezone.utc)
    return data


def pegar_workspace(x_workspace_id: str = Header(), session: Session = Depends(get_session)):
    if session.get(Workspace, x_workspace_id) is None:
        raise HTTPException(404, "Espaço de demonstração não encontrado")
    return x_workspace_id


def buscar(session, modelo, id, workspace_id, nome="Registro"):
    obj = session.get(modelo, id)
    if obj is None or obj.workspace_id != workspace_id:
        raise HTTPException(404, f"{nome} não encontrado")
    return obj


def _quantidade_com_sinal():
    return case(
        (Movimentacao.tipo == "entrada", Movimentacao.quantidade),
        else_=-Movimentacao.quantidade,
    )


def saldos_por_lote(session, workspace_id, filial_id=None, produto_id=None):
    consulta = (
        select(Movimentacao.lote_id, func.sum(_quantidade_com_sinal()))
        .where(Movimentacao.workspace_id == workspace_id)
        .group_by(Movimentacao.lote_id)
    )
    if filial_id:
        consulta = consulta.where(Movimentacao.filial_id == filial_id)
    if produto_id:
        consulta = consulta.where(Movimentacao.produto_id == produto_id)
    return {lote_id: int(saldo or 0) for lote_id, saldo in session.execute(consulta)}


def saldos_por_produto(session, workspace_id, filial_id=None):
    consulta = (
        select(Movimentacao.produto_id, func.sum(_quantidade_com_sinal()))
        .where(Movimentacao.workspace_id == workspace_id)
        .group_by(Movimentacao.produto_id)
    )
    if filial_id:
        consulta = consulta.where(Movimentacao.filial_id == filial_id)
    return {produto_id: int(saldo or 0) for produto_id, saldo in session.execute(consulta)}


def proximas_validades(session, workspace_id, filial_id=None):
    """Menor validade entre os lotes que ainda têm saldo, por produto."""
    saldos = saldos_por_lote(session, workspace_id, filial_id)
    consulta = select(Lote.id, Lote.produto_id, Lote.validade).where(
        Lote.workspace_id == workspace_id, Lote.validade.is_not(None)
    )
    if filial_id:
        consulta = consulta.where(Lote.filial_id == filial_id)

    resultado = {}
    for lote_id, produto_id, validade in session.execute(consulta):
        if saldos.get(lote_id, 0) <= 0:
            continue
        if produto_id not in resultado or validade < resultado[produto_id]:
            resultado[produto_id] = validade
    return resultado


def registrar_entrada(session, workspace_id, produto, filial_id, quantidade, motivo,
                      lote_codigo="", validade=None, observacao="", data=None):
    data = data or datetime.now(timezone.utc)
    if not lote_codigo:
        lote_codigo = f"L{data:%y%m%d}"

    # se já existe o mesmo lote (código e validade) nessa filial, soma nele
    lote = session.scalar(
        select(Lote).where(
            Lote.workspace_id == workspace_id,
            Lote.produto_id == produto.id,
            Lote.filial_id == filial_id,
            Lote.codigo == lote_codigo,
            Lote.validade == validade if validade else Lote.validade.is_(None),
        )
    )
    if lote is None:
        lote = Lote(workspace_id=workspace_id, produto_id=produto.id, filial_id=filial_id,
                    codigo=lote_codigo, validade=validade, criado_em=data)
        session.add(lote)
        session.flush()

    mov = Movimentacao(workspace_id=workspace_id, produto_id=produto.id, filial_id=filial_id,
                       lote_id=lote.id, tipo="entrada", motivo=motivo, quantidade=quantidade,
                       observacao=observacao, criado_em=data)
    session.add(mov)
    return [mov]


def registrar_saida(session, workspace_id, produto, filial_id, quantidade, motivo,
                    observacao="", lote_id=None):
    saldos = saldos_por_lote(session, workspace_id, filial_id, produto.id)
    lotes = session.scalars(
        select(Lote).where(Lote.workspace_id == workspace_id, Lote.produto_id == produto.id,
                           Lote.filial_id == filial_id)
    ).all()

    if lote_id:
        # baixa de um lote específico (ex.: perda de lote vencido)
        lote = next((l for l in lotes if l.id == lote_id), None)
        if lote is None:
            raise HTTPException(404, "Lote não encontrado nessa filial")
        saldo = saldos.get(lote.id, 0)
        if quantidade > saldo:
            raise HTTPException(422, f"Estoque insuficiente no lote {lote.codigo}: saldo de {saldo}")
        retirar = [(lote.id, quantidade)]
    else:
        lista = [(l.id, l.validade, saldos.get(l.id, 0)) for l in lotes]
        retirar = analise.escolher_lotes_fefo(lista, quantidade, hoje_brasilia())
        if retirar is None:
            disponivel = sum(s for _, v, s in lista if s > 0 and (v is None or v >= hoje_brasilia()))
            raise HTTPException(422, f"Estoque insuficiente: {disponivel} unidades disponíveis para saída (lotes vencidos não contam)")

    movimentacoes = []
    for id_lote, qtd in retirar:
        mov = Movimentacao(workspace_id=workspace_id, produto_id=produto.id, filial_id=filial_id,
                           lote_id=id_lote, tipo="saida", motivo=motivo, quantidade=qtd,
                           observacao=observacao)
        session.add(mov)
        movimentacoes.append(mov)
    return movimentacoes


def nomes_filiais(session, workspace_id):
    filiais = session.scalars(select(Filial).where(Filial.workspace_id == workspace_id))
    return {f.id: f.nome for f in filiais}


def montar_produto(produto, saldo, proxima_validade=None, fornecedor_nome=""):
    return {
        "id": produto.id,
        "ean": produto.ean,
        "nome": produto.nome,
        "marca": produto.marca,
        "categoria": produto.categoria,
        "descricao": produto.descricao,
        "peso": produto.peso,
        "qtd_por_fardo": produto.qtd_por_fardo,
        "validade_dias": produto.validade_dias,
        "custo": float(produto.custo),
        "preco_varejo": float(produto.preco_varejo),
        "preco_atacado": float(produto.preco_atacado),
        "qtd_minima_atacado": produto.qtd_minima_atacado,
        "estoque_minimo": produto.estoque_minimo,
        "fornecedor_id": produto.fornecedor_id,
        "fornecedor_nome": fornecedor_nome,
        "imagem_url": produto.imagem_url,
        "tem_imagem": bool(produto.imagem_tipo),
        "saldo": saldo,
        "status": analise.status_estoque(saldo, produto.estoque_minimo),
        "proxima_validade": proxima_validade,
    }

