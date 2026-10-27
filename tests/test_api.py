from datetime import date, timedelta

NOVO_PRODUTO = {
    "ean": "7890000000017",
    "nome": "Produto de teste 1kg",
    "marca": "Teste",
    "categoria": "Mercearia",
    "qtd_por_fardo": 10,
    "validade_dias": 180,
    "custo": 5.0,
    "preco_varejo": 7.5,
    "preco_atacado": 6.5,
    "qtd_minima_atacado": 10,
    "estoque_minimo": 20,
}


def filial(client, ws):
    return client.get("/api/filiais", headers=ws).json()[0]["id"]


def entrada(client, ws, produto_id, filial_id, quantidade, validade=None, lote=""):
    return client.post("/api/movimentacoes", headers=ws, json={
        "produto_id": produto_id, "filial_id": filial_id, "tipo": "entrada", "motivo": "compra",
        "quantidade": quantidade, "lote_codigo": lote, "validade": validade,
    })


def saida(client, ws, produto_id, filial_id, quantidade, **extra):
    return client.post("/api/movimentacoes", headers=ws, json={
        "produto_id": produto_id, "filial_id": filial_id, "tipo": "saida", "motivo": "venda",
        "quantidade": quantidade, **extra,
    })


def test_workspace_novo_vem_com_dados_de_demonstracao(client, workspace):
    produtos = client.get("/api/produtos", headers=workspace).json()
    assert len(produtos) >= 20
    assert all(p["saldo"] >= 0 for p in produtos)
    assert len(client.get("/api/filiais", headers=workspace).json()) == 2
    assert len(client.get("/api/fornecedores", headers=workspace).json()) >= 4


def test_exige_workspace_valido(client):
    assert client.get("/api/produtos", headers={"X-Workspace-Id": "nao-existe"}).status_code == 404


def test_entrada_e_saida_com_fefo(client, workspace):
    f = filial(client, workspace)
    produto = client.post("/api/produtos", json=NOVO_PRODUTO, headers=workspace).json()
    hoje = date.today()

    entrada(client, workspace, produto["id"], f, 30, str(hoje + timedelta(days=90)), "LOTE-B")
    entrada(client, workspace, produto["id"], f, 10, str(hoje + timedelta(days=20)), "LOTE-A")

    resposta = saida(client, workspace, produto["id"], f, 15)
    assert resposta.status_code == 201
    # tirou 10 do lote que vence antes e 5 do outro
    assert [(m["lote_codigo"], m["quantidade"]) for m in resposta.json()] == [("LOTE-A", 10), ("LOTE-B", 5)]

    detalhe = client.get(f"/api/produtos/{produto['id']}", headers=workspace).json()
    assert detalhe["saldo"] == 25
    assert [(l["codigo"], l["saldo"]) for l in detalhe["lotes"]] == [("LOTE-B", 25)]


def test_nao_vende_lote_vencido(client, workspace):
    f = filial(client, workspace)
    produto = client.post("/api/produtos", json=NOVO_PRODUTO, headers=workspace).json()
    entrada(client, workspace, produto["id"], f, 10, str(date.today() - timedelta(days=2)), "VENCIDO")

    resposta = saida(client, workspace, produto["id"], f, 1)
    assert resposta.status_code == 422
    assert "Estoque insuficiente" in resposta.json()["detail"]

    validades = client.get("/api/validades", headers=workspace).json()
    assert any(v["lote_codigo"] == "VENCIDO" and v["situacao"] == "vencido" for v in validades)

    # dar baixa como perda no lote específico funciona
    lote_id = next(v["lote_id"] for v in validades if v["lote_codigo"] == "VENCIDO")
    perda = client.post("/api/movimentacoes", headers=workspace, json={
        "produto_id": produto["id"], "filial_id": f, "tipo": "saida", "motivo": "perda",
        "quantidade": 10, "lote_id": lote_id,
    })
    assert perda.status_code == 201


def test_ean_duplicado(client, workspace):
    client.post("/api/produtos", json=NOVO_PRODUTO, headers=workspace)
    assert client.post("/api/produtos", json=NOVO_PRODUTO, headers=workspace).status_code == 409


def test_workspaces_sao_isolados(client, workspace):
    outro = {"X-Workspace-Id": client.post("/api/workspaces").json()["id"]}
    produto = client.post("/api/produtos", json=NOVO_PRODUTO, headers=workspace).json()
    assert client.delete(f"/api/produtos/{produto['id']}", headers=outro).status_code == 404
    assert client.get("/api/produtos", params={"busca": NOVO_PRODUTO["ean"]}, headers=outro).json() == []


def test_busca_por_ean(client, workspace):
    client.post("/api/produtos", json=NOVO_PRODUTO, headers=workspace)
    resultado = client.get("/api/produtos", params={"busca": "7890000000017"}, headers=workspace).json()
    assert [p["nome"] for p in resultado] == ["Produto de teste 1kg"]


def test_imagem_do_produto(client, workspace):
    produto = client.post("/api/produtos", json=NOVO_PRODUTO, headers=workspace).json()
    png_1px = (
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk"
        "+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    )
    assert client.put(f"/api/produtos/{produto['id']}/imagem", json={"imagem": png_1px}, headers=workspace).status_code == 204

    imagem = client.get(f"/api/imagens/{produto['id']}")
    assert imagem.status_code == 200
    assert imagem.headers["content-type"] == "image/png"

    invalida = client.put(f"/api/produtos/{produto['id']}/imagem", json={"imagem": "data:text/plain;base64,AAAA"},
                          headers=workspace)
    assert invalida.status_code == 422


def test_pedido_de_compra_recebido_entra_no_estoque(client, workspace):
    f = filial(client, workspace)
    fornecedor = client.get("/api/fornecedores", headers=workspace).json()[0]
    produto = client.post("/api/produtos", json={**NOVO_PRODUTO, "fornecedor_id": fornecedor["id"]},
                          headers=workspace).json()

    pedido = client.post("/api/pedidos", headers=workspace, json={
        "fornecedor_id": fornecedor["id"], "filial_id": f,
        "itens": [{"produto_id": produto["id"], "quantidade": 40, "custo": 4.8}],
    }).json()
    assert pedido["status"] == "aberto"
    assert pedido["total"] == 192.0

    item_id = pedido["itens"][0]["id"]
    validade = str(date.today() + timedelta(days=150))
    recebido = client.post(f"/api/pedidos/{pedido['id']}/receber", headers=workspace,
                           json={"itens": [{"item_id": item_id, "lote_codigo": "NF123", "validade": validade}]}).json()
    assert recebido["status"] == "recebido"

    detalhe = client.get(f"/api/produtos/{produto['id']}", headers=workspace).json()
    assert detalhe["saldo"] == 40
    assert detalhe["custo"] == 4.8
    assert detalhe["lotes"][0]["codigo"] == "NF123"

    # não dá para receber de novo
    assert client.post(f"/api/pedidos/{pedido['id']}/receber", headers=workspace, json={}).status_code == 409


def test_sugestao_de_compra(client, workspace):
    f = filial(client, workspace)
    sugestao = client.get("/api/compras/sugestao", params={"filial_id": f}, headers=workspace).json()
    assert sugestao, "a demonstração deve ter algo para comprar"
    item = sugestao[0]["itens"][0]
    assert item["quantidade"] % item["qtd_por_fardo"] == 0


def test_painel(client, workspace):
    painel = client.get("/api/painel", headers=workspace).json()
    assert painel["indicadores"]["total_produtos"] >= 20
    assert painel["indicadores"]["lotes_vencidos"] >= 1
    assert painel["indicadores"]["lotes_vencendo"] >= 1
    assert len(painel["serie"]) == 30
    assert painel["ruptura"]
    assert {r["classe"] for r in painel["resumo_abc"]} == {"A", "B", "C"}


def test_restaurar_demonstracao(client, workspace):
    client.post("/api/produtos", json=NOVO_PRODUTO, headers=workspace)
    client.post("/api/workspaces/restaurar", headers=workspace)
    assert client.get("/api/produtos", params={"busca": NOVO_PRODUTO["ean"]}, headers=workspace).json() == []


def test_exportar_csv(client, workspace):
    resposta = client.get("/api/relatorios/estoque.csv", headers=workspace)
    assert resposta.status_code == 200
    assert resposta.text.splitlines()[0].startswith("﻿EAN;Produto")
