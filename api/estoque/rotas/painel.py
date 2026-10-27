from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import analise
from ..db import Lote, Movimentacao, Pedido, Produto, get_session
from ..estoque import FUSO_BRASILIA, hoje_brasilia, para_utc, pegar_workspace, saldos_por_lote, saldos_por_produto

router = APIRouter(prefix="/api")


@router.get("/painel")
def painel(filial_id: int | None = None, workspace_id: str = Depends(pegar_workspace),
           session: Session = Depends(get_session)):
    agora = datetime.now(timezone.utc)
    hoje = hoje_brasilia()
    ha_30_dias = agora - timedelta(days=30)

    produtos = session.scalars(select(Produto).where(Produto.workspace_id == workspace_id)).all()
    saldos = saldos_por_produto(session, workspace_id, filial_id)

    consulta = select(
        Movimentacao.produto_id, Movimentacao.tipo, Movimentacao.motivo, Movimentacao.quantidade, Movimentacao.criado_em
    ).where(Movimentacao.workspace_id == workspace_id, Movimentacao.criado_em >= ha_30_dias)
    if filial_id:
        consulta = consulta.where(Movimentacao.filial_id == filial_id)

    vendas = {p.id: 0 for p in produtos}
    serie = []
    for produto_id, tipo, motivo, quantidade, criado_em in session.execute(consulta):
        serie.append((para_utc(criado_em).astimezone(FUSO_BRASILIA).date(), tipo, quantidade))
        if tipo == "saida" and motivo == "venda":
            vendas[produto_id] += quantidade

    # vencimentos
    saldos_lote = saldos_por_lote(session, workspace_id, filial_id)
    consulta_lotes = select(Lote.id, Lote.validade, Lote.produto_id).where(
        Lote.workspace_id == workspace_id, Lote.validade.is_not(None)
    )
    if filial_id:
        consulta_lotes = consulta_lotes.where(Lote.filial_id == filial_id)
    custo = {p.id: float(p.custo) for p in produtos}
    vencidos = {"lotes": 0, "valor": 0.0}
    vencendo = {"lotes": 0, "valor": 0.0}
    for lote_id, validade, produto_id in session.execute(consulta_lotes):
        saldo = saldos_lote.get(lote_id, 0)
        if saldo <= 0:
            continue
        situacao = analise.situacao_validade(validade, hoje)
        if situacao == "vencido":
            vencidos["lotes"] += 1
            vencidos["valor"] += saldo * custo[produto_id]
        elif situacao == "vencendo":
            vencendo["lotes"] += 1
            vencendo["valor"] += saldo * custo[produto_id]

    # ruptura: abaixo do mínimo ou acaba em menos de 10 dias
    ruptura = []
    for p in produtos:
        saldo = saldos.get(p.id, 0)
        consumo = analise.consumo_medio_diario(vendas[p.id], 30)
        cobertura = analise.dias_de_cobertura(saldo, consumo)
        status = analise.status_estoque(saldo, p.estoque_minimo)
        if status != "ok" or (cobertura is not None and cobertura < 10):
            ruptura.append({
                "produto_id": p.id, "nome": p.nome, "ean": p.ean, "saldo": saldo,
                "estoque_minimo": p.estoque_minimo, "consumo_diario": round(consumo, 1),
                "dias_de_cobertura": round(cobertura, 1) if cobertura is not None else None, "status": status,
            })
    ruptura.sort(key=lambda r: r["dias_de_cobertura"] if r["dias_de_cobertura"] is not None else 9999)

    # curva ABC pelo faturamento das vendas (quantidade x preço de varejo)
    faturamento = {p.id: vendas[p.id] * float(p.preco_varejo) for p in produtos}
    classes = analise.curva_abc(faturamento)
    resumo_abc = []
    total_faturamento = sum(faturamento.values())
    for classe in ["A", "B", "C"]:
        ids = [pid for pid, c in classes.items() if c == classe]
        valor = sum(faturamento[pid] for pid in ids)
        resumo_abc.append({
            "classe": classe,
            "itens": len(ids),
            "valor": round(valor, 2),
            "percentual": round(valor / total_faturamento * 100, 1) if total_faturamento else 0,
        })
    mais_vendidos = sorted(produtos, key=lambda p: faturamento[p.id], reverse=True)[:5]

    consulta_pedidos = select(Pedido.id).where(Pedido.workspace_id == workspace_id, Pedido.status == "aberto")
    if filial_id:
        consulta_pedidos = consulta_pedidos.where(Pedido.filial_id == filial_id)
    pedidos_abertos = session.scalars(consulta_pedidos).all()

    return {
        "indicadores": {
            "total_produtos": len(produtos),
            "valor_em_estoque": round(sum(max(saldos.get(p.id, 0), 0) * float(p.custo) for p in produtos), 2),
            "faturamento_30_dias": round(total_faturamento, 2),
            "abaixo_minimo": len([r for r in ruptura if r["status"] != "ok"]),
            "lotes_vencidos": vencidos["lotes"],
            "valor_vencido": round(vencidos["valor"], 2),
            "lotes_vencendo": vencendo["lotes"],
            "valor_vencendo": round(vencendo["valor"], 2),
            "pedidos_abertos": len(pedidos_abertos),
        },
        "serie": analise.serie_diaria(serie, hoje, 30),
        "ruptura": ruptura[:10],
        "resumo_abc": resumo_abc,
        "mais_vendidos": [
            {"produto_id": p.id, "nome": p.nome, "quantidade": vendas[p.id], "faturamento": round(faturamento[p.id], 2),
             "classe": classes[p.id]}
            for p in mais_vendidos
        ],
    }
