import base64
import csv
import io
import json
import urllib.request

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..db import Filial, Fornecedor, Lote, Movimentacao, PedidoItem, Produto, get_session
from ..estoque import (
    buscar, hoje_brasilia, montar_produto, nomes_filiais, para_utc, pegar_workspace,
    proximas_validades, saldos_por_lote, saldos_por_produto,
)
from .. import analise
from ..schemas import ImagemEntrada, ProdutoDetalhe, ProdutoEntrada, ProdutoSaida

router = APIRouter(prefix="/api")

TIPOS_IMAGEM = {"image/jpeg", "image/png", "image/webp"}


def nomes_fornecedores(session, workspace_id):
    fornecedores = session.scalars(select(Fornecedor).where(Fornecedor.workspace_id == workspace_id))
    return {f.id: f.nome for f in fornecedores}


def validar_fornecedor(session, workspace_id, fornecedor_id):
    if fornecedor_id is not None:
        buscar(session, Fornecedor, fornecedor_id, workspace_id, "Fornecedor")


def ean_repetido(session, workspace_id, ean, ignorar_id=None):
    if not ean:
        return False
    consulta = select(Produto.id).where(Produto.workspace_id == workspace_id, Produto.ean == ean)
    if ignorar_id:
        consulta = consulta.where(Produto.id != ignorar_id)
    return session.scalar(consulta) is not None


@router.get("/produtos", response_model=list[ProdutoSaida])
def listar_produtos(
    busca: str = "",
    categoria: str = "",
    status: str = "",
    fornecedor_id: int | None = None,
    filial_id: int | None = None,
    workspace_id: str = Depends(pegar_workspace),
    session: Session = Depends(get_session),
):
    consulta = select(Produto).where(Produto.workspace_id == workspace_id).order_by(Produto.nome)
    busca = busca.strip().lower()
    if busca:
        termo = f"%{busca}%"
        consulta = consulta.where(
            func.lower(Produto.nome).like(termo)
            | func.lower(Produto.marca).like(termo)
            | Produto.ean.like(termo)
        )
    if categoria:
        consulta = consulta.where(Produto.categoria == categoria)
    if fornecedor_id:
        consulta = consulta.where(Produto.fornecedor_id == fornecedor_id)

    saldos = saldos_por_produto(session, workspace_id, filial_id)
    validades = proximas_validades(session, workspace_id, filial_id)
    fornecedores = nomes_fornecedores(session, workspace_id)

    produtos = []
    for p in session.scalars(consulta):
        item = montar_produto(p, saldos.get(p.id, 0), validades.get(p.id), fornecedores.get(p.fornecedor_id, ""))
        if status and item["status"] != status:
            continue
        produtos.append(item)
    return produtos


@router.get("/produtos/{produto_id}", response_model=ProdutoDetalhe)
def detalhe_produto(
    produto_id: int,
    filial_id: int | None = None,
    workspace_id: str = Depends(pegar_workspace),
    session: Session = Depends(get_session),
):
    produto = buscar(session, Produto, produto_id, workspace_id, "Produto")
    filiais = nomes_filiais(session, workspace_id)
    saldos_lote = saldos_por_lote(session, workspace_id, produto_id=produto.id)
    hoje = hoje_brasilia()

    lotes = []
    saldo_por_filial = {nome: 0 for nome in filiais.values()}
    consulta_lotes = select(Lote).where(Lote.produto_id == produto.id).order_by(Lote.validade)
    for lote in session.scalars(consulta_lotes):
        saldo = saldos_lote.get(lote.id, 0)
        saldo_por_filial[filiais[lote.filial_id]] += saldo
        if saldo <= 0 or (filial_id and lote.filial_id != filial_id):
            continue
        lotes.append({
            "id": lote.id,
            "codigo": lote.codigo,
            "filial_id": lote.filial_id,
            "filial_nome": filiais[lote.filial_id],
            "validade": lote.validade,
            "saldo": saldo,
            "situacao": analise.situacao_validade(lote.validade, hoje),
        })

    consulta_movs = (
        select(Movimentacao, Lote.codigo)
        .join(Lote, Lote.id == Movimentacao.lote_id)
        .where(Movimentacao.produto_id == produto.id)
        .order_by(Movimentacao.criado_em.desc(), Movimentacao.id.desc())
        .limit(15)
    )
    if filial_id:
        consulta_movs = consulta_movs.where(Movimentacao.filial_id == filial_id)
    movimentacoes = [
        {
            "id": m.id, "produto_id": produto.id, "produto_nome": produto.nome, "produto_ean": produto.ean,
            "filial_nome": filiais[m.filial_id], "lote_codigo": codigo, "tipo": m.tipo, "motivo": m.motivo,
            "quantidade": m.quantidade, "observacao": m.observacao, "criado_em": para_utc(m.criado_em),
        }
        for m, codigo in session.execute(consulta_movs)
    ]

    saldo = sum(l["saldo"] for l in lotes) if filial_id else sum(saldo_por_filial.values())
    validades = [l["validade"] for l in lotes if l["validade"]]
    fornecedor = session.get(Fornecedor, produto.fornecedor_id) if produto.fornecedor_id else None

    dados = montar_produto(produto, saldo, min(validades) if validades else None, fornecedor.nome if fornecedor else "")
    dados["lotes"] = lotes
    dados["movimentacoes"] = movimentacoes
    dados["saldo_por_filial"] = saldo_por_filial
    return dados


@router.post("/produtos", status_code=201, response_model=ProdutoSaida)
def criar_produto(dados: ProdutoEntrada, workspace_id: str = Depends(pegar_workspace),
                  session: Session = Depends(get_session)):
    if ean_repetido(session, workspace_id, dados.ean):
        raise HTTPException(409, f"Já existe um produto com o EAN {dados.ean}")
    validar_fornecedor(session, workspace_id, dados.fornecedor_id)

    produto = Produto(workspace_id=workspace_id, **dados.model_dump())
    session.add(produto)
    session.commit()
    return montar_produto(produto, 0)


@router.put("/produtos/{produto_id}", response_model=ProdutoSaida)
def editar_produto(produto_id: int, dados: ProdutoEntrada, workspace_id: str = Depends(pegar_workspace),
                   session: Session = Depends(get_session)):
    produto = buscar(session, Produto, produto_id, workspace_id, "Produto")
    if ean_repetido(session, workspace_id, dados.ean, ignorar_id=produto_id):
        raise HTTPException(409, f"Já existe um produto com o EAN {dados.ean}")
    validar_fornecedor(session, workspace_id, dados.fornecedor_id)

    for campo, valor in dados.model_dump().items():
        setattr(produto, campo, valor)
    session.commit()
    saldo = saldos_por_produto(session, workspace_id).get(produto.id, 0)
    return montar_produto(produto, saldo)


@router.delete("/produtos/{produto_id}", status_code=204)
def excluir_produto(produto_id: int, workspace_id: str = Depends(pegar_workspace),
                    session: Session = Depends(get_session)):
    produto = buscar(session, Produto, produto_id, workspace_id, "Produto")
    em_pedido = session.scalar(select(PedidoItem.id).where(PedidoItem.produto_id == produto.id))
    if em_pedido:
        raise HTTPException(409, "Esse produto está em pedidos de compra e não pode ser excluído")

    session.execute(delete(Movimentacao).where(Movimentacao.produto_id == produto.id))
    session.execute(delete(Lote).where(Lote.produto_id == produto.id))
    session.delete(produto)
    session.commit()
    return Response(status_code=204)


@router.put("/produtos/{produto_id}/imagem", status_code=204)
def enviar_imagem(produto_id: int, dados: ImagemEntrada, workspace_id: str = Depends(pegar_workspace),
                  session: Session = Depends(get_session)):
    produto = buscar(session, Produto, produto_id, workspace_id, "Produto")

    # o front manda a imagem já reduzida, no formato "data:image/webp;base64,AAAA..."
    try:
        cabecalho, conteudo = dados.imagem.split(",", 1)
        tipo = cabecalho.removeprefix("data:").removesuffix(";base64")
        arquivo = base64.b64decode(conteudo)
    except ValueError:
        raise HTTPException(422, "Imagem inválida")
    if tipo not in TIPOS_IMAGEM:
        raise HTTPException(422, "Envie uma imagem JPG, PNG ou WEBP")
    if len(arquivo) > 800_000:
        raise HTTPException(422, "Imagem muito grande")

    produto.imagem = arquivo
    produto.imagem_tipo = tipo
    session.commit()
    return Response(status_code=204)


# não usa o header do workspace porque a tag <img> não manda header; o id do produto já é suficiente
@router.get("/imagens/{produto_id}")
def ver_imagem(produto_id: int, session: Session = Depends(get_session)):
    produto = session.get(Produto, produto_id)
    if produto is None or not produto.imagem_tipo:
        raise HTTPException(404, "Imagem não encontrada")
    return Response(content=produto.imagem, media_type=produto.imagem_tipo,
                    headers={"Cache-Control": "public, max-age=86400"})


@router.get("/categorias")
def listar_categorias(workspace_id: str = Depends(pegar_workspace), session: Session = Depends(get_session)):
    consulta = select(Produto.categoria).where(Produto.workspace_id == workspace_id).distinct().order_by(Produto.categoria)
    return list(session.scalars(consulta))


@router.get("/filiais")
def listar_filiais(workspace_id: str = Depends(pegar_workspace), session: Session = Depends(get_session)):
    filiais = session.scalars(select(Filial).where(Filial.workspace_id == workspace_id).order_by(Filial.id))
    return [{"id": f.id, "nome": f.nome} for f in filiais]


@router.get("/codigo-barras/{ean}")
def consultar_codigo_barras(ean: str, workspace_id: str = Depends(pegar_workspace)):
    """Busca nome, marca e foto do produto no Open Food Facts (base aberta de produtos)."""
    if not ean.isdigit() or len(ean) not in (8, 12, 13, 14):
        raise HTTPException(422, "Código de barras inválido")

    campos = "product_name,product_name_pt,brands,image_front_url,quantity,categories_tags_pt"
    url = f"https://world.openfoodfacts.org/api/v2/product/{ean}.json?fields={campos}"
    pedido = urllib.request.Request(url, headers={"User-Agent": "controle-estoque/1.0 (projeto de estudo)"})
    try:
        with urllib.request.urlopen(pedido, timeout=8) as resposta:
            dados = json.load(resposta)
    except Exception:
        raise HTTPException(502, "Não foi possível consultar a base de produtos agora. Preencha manualmente.")

    produto = dados.get("product")
    if dados.get("status") != 1 or not produto:
        raise HTTPException(404, "Produto não encontrado na base. Preencha manualmente.")

    return {
        "ean": ean,
        "nome": produto.get("product_name_pt") or produto.get("product_name") or "",
        "marca": (produto.get("brands") or "").split(",")[0].strip(),
        "peso": produto.get("quantity") or "",
        "imagem_url": produto.get("image_front_url") or "",
    }


@router.get("/relatorios/estoque.csv")
def exportar_csv(filial_id: int | None = None, workspace_id: str = Depends(pegar_workspace),
                 session: Session = Depends(get_session)):
    produtos = listar_produtos(filial_id=filial_id, busca="", categoria="", status="", fornecedor_id=None,
                               workspace_id=workspace_id, session=session)

    arquivo = io.StringIO()
    writer = csv.writer(arquivo, delimiter=";")
    writer.writerow(["EAN", "Produto", "Marca", "Categoria", "Fornecedor", "Saldo (un)", "Fardos", "Estoque mínimo",
                     "Custo", "Preço varejo", "Preço atacado", "Próxima validade", "Status"])

    def real(valor):
        return f"{valor:.2f}".replace(".", ",")

    for p in produtos:
        writer.writerow([
            p["ean"], p["nome"], p["marca"], p["categoria"], p["fornecedor_nome"], p["saldo"],
            p["saldo"] // p["qtd_por_fardo"], p["estoque_minimo"], real(p["custo"]), real(p["preco_varejo"]),
            real(p["preco_atacado"]),
            p["proxima_validade"].strftime("%d/%m/%Y") if p["proxima_validade"] else "", p["status"],
        ])

    # o ﻿ (BOM) faz o Excel abrir os acentos certo
    return Response(
        content="﻿" + arquivo.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="estoque.csv"'},
    )
