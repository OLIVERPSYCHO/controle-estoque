import csv
import io
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, Header, HTTPException, Response
from sqlalchemy import case, delete, func, select
from sqlalchemy.orm import Session

from . import analise, db
from .db import Movimentacao, Produto, Workspace, get_session
from .demo import criar_dados_demo
from .schemas import MovimentacaoEntrada, MovimentacaoSaida, Painel, ProdutoEntrada, ProdutoSaida

FUSO_BRASILIA = timezone(timedelta(hours=-3))

app = FastAPI(title="Controle de Estoque", docs_url="/api/docs", openapi_url="/api/openapi.json")
db.configurar_banco()


def pegar_workspace(x_workspace_id: str = Header(), session: Session = Depends(get_session)):
    if session.get(Workspace, x_workspace_id) is None:
        raise HTTPException(404, "Espaço de demonstração não encontrado")
    return x_workspace_id


def para_utc(data):
    # o sqlite devolve a data sem fuso
    if data.tzinfo is None:
        return data.replace(tzinfo=timezone.utc)
    return data


def calcular_saldos(session, workspace_id):
    quantidade = case(
        (Movimentacao.tipo == "entrada", Movimentacao.quantidade),
        else_=-Movimentacao.quantidade,
    )
    consulta = (
        select(Movimentacao.produto_id, func.sum(quantidade))
        .where(Movimentacao.workspace_id == workspace_id)
        .group_by(Movimentacao.produto_id)
    )
    saldos = {}
    for produto_id, saldo in session.execute(consulta):
        saldos[produto_id] = int(saldo or 0)
    return saldos


def montar_produto(produto, saldo):
    custo = float(produto.custo_unitario)
    return ProdutoSaida(
        id=produto.id,
        sku=produto.sku,
        nome=produto.nome,
        categoria=produto.categoria,
        unidade=produto.unidade,
        estoque_minimo=produto.estoque_minimo,
        custo_unitario=custo,
        saldo=saldo,
        status=analise.status_estoque(saldo, produto.estoque_minimo),
        valor_em_estoque=round(max(saldo, 0) * custo, 2),
    )


def montar_movimentacao(mov, produto):
    return MovimentacaoSaida(
        id=mov.id,
        produto_id=produto.id,
        produto_nome=produto.nome,
        produto_sku=produto.sku,
        tipo=mov.tipo,
        quantidade=mov.quantidade,
        observacao=mov.observacao,
        criado_em=para_utc(mov.criado_em),
    )


def buscar_produto(session, workspace_id, produto_id):
    produto = session.get(Produto, produto_id)
    if produto is None or produto.workspace_id != workspace_id:
        raise HTTPException(404, "Produto não encontrado")
    return produto


def sku_repetido(session, workspace_id, sku, ignorar_id=None):
    consulta = select(Produto.id).where(Produto.workspace_id == workspace_id, Produto.sku == sku)
    if ignorar_id:
        consulta = consulta.where(Produto.id != ignorar_id)
    return session.scalar(consulta) is not None


def apagar_dados(session, workspace_id):
    session.execute(delete(Movimentacao).where(Movimentacao.workspace_id == workspace_id))
    session.execute(delete(Produto).where(Produto.workspace_id == workspace_id))


@app.get("/api/saude")
def saude():
    return {"status": "ok"}


# Cada visitante ganha um espaço proprio ja com dados de exemplo
@app.post("/api/workspaces", status_code=201)
def criar_workspace(session: Session = Depends(get_session)):
    # apaga os espaços com mais de 14 dias para o banco não crescer
    limite = datetime.now(timezone.utc) - timedelta(days=14)
    antigos = session.scalars(select(Workspace.id).where(Workspace.criado_em < limite)).all()
    for antigo_id in antigos:
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


@app.get("/api/produtos", response_model=list[ProdutoSaida])
def listar_produtos(
    busca: str = "",
    categoria: str = "",
    status: str = "",
    workspace_id: str = Depends(pegar_workspace),
    session: Session = Depends(get_session),
):
    consulta = select(Produto).where(Produto.workspace_id == workspace_id).order_by(Produto.nome)
    if busca.strip():
        termo = f"%{busca.strip().lower()}%"
        consulta = consulta.where(func.lower(Produto.nome).like(termo) | func.lower(Produto.sku).like(termo))
    if categoria:
        consulta = consulta.where(Produto.categoria == categoria)

    saldos = calcular_saldos(session, workspace_id)
    produtos = []
    for produto in session.scalars(consulta):
        item = montar_produto(produto, saldos.get(produto.id, 0))
        if status and item.status != status:
            continue
        produtos.append(item)
    return produtos


@app.post("/api/produtos", status_code=201, response_model=ProdutoSaida)
def criar_produto(
    dados: ProdutoEntrada,
    workspace_id: str = Depends(pegar_workspace),
    session: Session = Depends(get_session),
):
    if sku_repetido(session, workspace_id, dados.sku):
        raise HTTPException(409, f"Já existe um produto com o SKU {dados.sku}")
    produto = Produto(workspace_id=workspace_id, **dados.model_dump())
    session.add(produto)
    session.commit()
    return montar_produto(produto, 0)


@app.put("/api/produtos/{produto_id}", response_model=ProdutoSaida)
def editar_produto(
    produto_id: int,
    dados: ProdutoEntrada,
    workspace_id: str = Depends(pegar_workspace),
    session: Session = Depends(get_session),
):
    produto = buscar_produto(session, workspace_id, produto_id)
    if sku_repetido(session, workspace_id, dados.sku, ignorar_id=produto_id):
        raise HTTPException(409, f"Já existe um produto com o SKU {dados.sku}")
    for campo, valor in dados.model_dump().items():
        setattr(produto, campo, valor)
    session.commit()
    saldo = calcular_saldos(session, workspace_id).get(produto.id, 0)
    return montar_produto(produto, saldo)


@app.delete("/api/produtos/{produto_id}", status_code=204)
def excluir_produto(
    produto_id: int,
    workspace_id: str = Depends(pegar_workspace),
    session: Session = Depends(get_session),
):
    produto = buscar_produto(session, workspace_id, produto_id)
    session.execute(delete(Movimentacao).where(Movimentacao.produto_id == produto.id))
    session.delete(produto)
    session.commit()
    return Response(status_code=204)


@app.get("/api/categorias")
def listar_categorias(workspace_id: str = Depends(pegar_workspace), session: Session = Depends(get_session)):
    consulta = (
        select(Produto.categoria)
        .where(Produto.workspace_id == workspace_id)
        .distinct()
        .order_by(Produto.categoria)
    )
    return list(session.scalars(consulta))


@app.get("/api/movimentacoes", response_model=list[MovimentacaoSaida])
def listar_movimentacoes(
    produto_id: int | None = None,
    limite: int = 100,
    workspace_id: str = Depends(pegar_workspace),
    session: Session = Depends(get_session),
):
    consulta = (
        select(Movimentacao, Produto)
        .join(Produto, Produto.id == Movimentacao.produto_id)
        .where(Movimentacao.workspace_id == workspace_id)
        .order_by(Movimentacao.criado_em.desc(), Movimentacao.id.desc())
        .limit(min(limite, 500))
    )
    if produto_id:
        consulta = consulta.where(Movimentacao.produto_id == produto_id)
    return [montar_movimentacao(mov, produto) for mov, produto in session.execute(consulta)]


@app.post("/api/movimentacoes", status_code=201, response_model=MovimentacaoSaida)
def registrar_movimentacao(
    dados: MovimentacaoEntrada,
    workspace_id: str = Depends(pegar_workspace),
    session: Session = Depends(get_session),
):
    produto = buscar_produto(session, workspace_id, dados.produto_id)
    if dados.tipo == "saida":
        saldo = calcular_saldos(session, workspace_id).get(produto.id, 0)
        if dados.quantidade > saldo:
            raise HTTPException(422, f"Estoque insuficiente: saldo atual de {saldo} {produto.unidade}")

    mov = Movimentacao(workspace_id=workspace_id, **dados.model_dump())
    session.add(mov)
    session.commit()
    return montar_movimentacao(mov, produto)


@app.get("/api/painel", response_model=Painel)
def painel(workspace_id: str = Depends(pegar_workspace), session: Session = Depends(get_session)):
    agora = datetime.now(timezone.utc)
    ha_30_dias = agora - timedelta(days=30)
    ha_90_dias = agora - timedelta(days=90)

    produtos = session.scalars(select(Produto).where(Produto.workspace_id == workspace_id)).all()
    saldos = calcular_saldos(session, workspace_id)
    itens = {p.id: montar_produto(p, saldos.get(p.id, 0)) for p in produtos}

    movimentos = session.execute(
        select(Movimentacao.produto_id, Movimentacao.tipo, Movimentacao.quantidade, Movimentacao.criado_em)
        .where(Movimentacao.workspace_id == workspace_id, Movimentacao.criado_em >= ha_90_dias)
    ).all()

    saidas_30 = {p.id: 0 for p in produtos}
    saidas_90 = {p.id: 0 for p in produtos}
    movimentos_30 = []
    for produto_id, tipo, quantidade, criado_em in movimentos:
        data = para_utc(criado_em)
        if tipo == "saida":
            saidas_90[produto_id] += quantidade
        if data >= ha_30_dias:
            movimentos_30.append((data.astimezone(FUSO_BRASILIA).date(), tipo, quantidade))
            if tipo == "saida":
                saidas_30[produto_id] += quantidade

    indicadores = {
        "total_produtos": len(produtos),
        "valor_em_estoque": round(sum(i.valor_em_estoque for i in itens.values()), 2),
        "itens_abaixo_minimo": len([i for i in itens.values() if i.status == "baixo"]),
        "itens_zerados": len([i for i in itens.values() if i.status == "zerado"]),
        "entradas_30_dias": sum(q for _, t, q in movimentos_30 if t == "entrada"),
        "saidas_30_dias": sum(q for _, t, q in movimentos_30 if t == "saida"),
    }

    # alerta: abaixo do mínimo ou acaba em menos de 15 dias
    alertas = []
    for produto in produtos:
        item = itens[produto.id]
        consumo = analise.consumo_medio_diario(saidas_30[produto.id], 30)
        cobertura = analise.dias_de_cobertura(item.saldo, consumo)
        if item.status != "ok" or (cobertura is not None and cobertura < 15):
            alertas.append({
                "produto_id": produto.id,
                "sku": produto.sku,
                "nome": produto.nome,
                "saldo": item.saldo,
                "estoque_minimo": produto.estoque_minimo,
                "consumo_medio_diario": round(consumo, 2),
                "dias_de_cobertura": round(cobertura, 1) if cobertura is not None else None,
                "status": item.status,
            })
    alertas.sort(key=lambda a: a["dias_de_cobertura"] if a["dias_de_cobertura"] is not None else 9999)

    # curva ABC pelo valor que saiu nos ultimos 90 dias
    valores = {p.id: saidas_90[p.id] * float(p.custo_unitario) for p in produtos}
    classes = analise.curva_abc(valores)
    curva = []
    for produto in produtos:
        curva.append({
            "produto_id": produto.id,
            "sku": produto.sku,
            "nome": produto.nome,
            "valor_consumido": round(valores[produto.id], 2),
            "classe": classes[produto.id],
        })
    curva.sort(key=lambda item: item["valor_consumido"], reverse=True)

    resumo_abc = []
    for classe in ["A", "B", "C"]:
        da_classe = [item for item in curva if item["classe"] == classe]
        resumo_abc.append({
            "classe": classe,
            "itens": len(da_classe),
            "valor": round(sum(item["valor_consumido"] for item in da_classe), 2),
        })

    hoje = agora.astimezone(FUSO_BRASILIA).date()
    return {
        "indicadores": indicadores,
        "serie": analise.serie_diaria(movimentos_30, hoje, 30),
        "alertas": alertas,
        "curva_abc": curva,
        "resumo_abc": resumo_abc,
    }


@app.get("/api/relatorios/estoque.csv")
def exportar_csv(workspace_id: str = Depends(pegar_workspace), session: Session = Depends(get_session)):
    produtos = listar_produtos(workspace_id=workspace_id, session=session)

    arquivo = io.StringIO()
    writer = csv.writer(arquivo, delimiter=";")
    writer.writerow(["SKU", "Produto", "Categoria", "Unidade", "Saldo", "Estoque mínimo",
                     "Custo unitário", "Valor em estoque", "Status"])
    for p in produtos:
        writer.writerow([
            p.sku, p.nome, p.categoria, p.unidade, p.saldo, p.estoque_minimo,
            str(p.custo_unitario).replace(".", ","), str(p.valor_em_estoque).replace(".", ","), p.status,
        ])

    # o ﻿ (BOM) faz o Excel abrir os acentos certo
    return Response(
        content="﻿" + arquivo.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="estoque.csv"'},
    )
