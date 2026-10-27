NOVO_PRODUTO = {
    "sku": "TST-001",
    "nome": "Produto de teste",
    "categoria": "Testes",
    "unidade": "un",
    "estoque_minimo": 5,
    "custo_unitario": 10.0,
}


def test_workspace_novo_vem_com_dados_de_demonstracao(client, workspace):
    produtos = client.get("/api/produtos", headers=workspace).json()
    assert len(produtos) > 10
    assert all(p["saldo"] >= 0 for p in produtos)


def test_exige_workspace_valido(client):
    assert client.get("/api/produtos", headers={"X-Workspace-Id": "nao-existe"}).status_code == 404


def test_movimentacoes_atualizam_o_saldo(client, workspace):
    produto = client.post("/api/produtos", json=NOVO_PRODUTO, headers=workspace).json()
    assert produto["saldo"] == 0 and produto["status"] == "zerado"

    client.post("/api/movimentacoes", json={"produto_id": produto["id"], "tipo": "entrada", "quantidade": 20}, headers=workspace)
    client.post("/api/movimentacoes", json={"produto_id": produto["id"], "tipo": "saida", "quantidade": 16}, headers=workspace)

    atualizado = client.get("/api/produtos", params={"busca": "TST-001"}, headers=workspace).json()[0]
    assert atualizado["saldo"] == 4
    assert atualizado["status"] == "baixo"
    assert atualizado["valor_em_estoque"] == 40.0


def test_bloqueia_saida_maior_que_o_saldo(client, workspace):
    produto = client.post("/api/produtos", json=NOVO_PRODUTO, headers=workspace).json()
    resposta = client.post(
        "/api/movimentacoes", json={"produto_id": produto["id"], "tipo": "saida", "quantidade": 1}, headers=workspace
    )
    assert resposta.status_code == 422
    assert "Estoque insuficiente" in resposta.json()["detail"]


def test_sku_duplicado(client, workspace):
    client.post("/api/produtos", json=NOVO_PRODUTO, headers=workspace)
    assert client.post("/api/produtos", json=NOVO_PRODUTO, headers=workspace).status_code == 409


def test_workspaces_sao_isolados(client, workspace):
    outro = {"X-Workspace-Id": client.post("/api/workspaces").json()["id"]}
    produto = client.post("/api/produtos", json=NOVO_PRODUTO, headers=workspace).json()

    assert client.delete(f"/api/produtos/{produto['id']}", headers=outro).status_code == 404
    assert client.get("/api/produtos", params={"busca": "TST-001"}, headers=outro).json() == []


def test_editar_e_excluir_produto(client, workspace):
    produto = client.post("/api/produtos", json=NOVO_PRODUTO, headers=workspace).json()
    editado = client.put(
        f"/api/produtos/{produto['id']}", json={**NOVO_PRODUTO, "nome": "Nome novo"}, headers=workspace
    ).json()
    assert editado["nome"] == "Nome novo"

    assert client.delete(f"/api/produtos/{produto['id']}", headers=workspace).status_code == 204
    assert client.get("/api/produtos", params={"busca": "TST-001"}, headers=workspace).json() == []


def test_painel(client, workspace):
    painel = client.get("/api/painel", headers=workspace).json()
    assert painel["indicadores"]["total_produtos"] > 10
    assert len(painel["serie"]) == 30
    assert painel["alertas"], "o estoque de demonstração deve ter itens em alerta"
    assert {r["classe"] for r in painel["resumo_abc"]} == {"A", "B", "C"}
    assert painel["curva_abc"][0]["classe"] == "A"


def test_restaurar_demonstracao(client, workspace):
    client.post("/api/produtos", json=NOVO_PRODUTO, headers=workspace)
    client.post("/api/workspaces/restaurar", headers=workspace)
    assert client.get("/api/produtos", params={"busca": "TST-001"}, headers=workspace).json() == []


def test_exportar_csv(client, workspace):
    resposta = client.get("/api/relatorios/estoque.csv", headers=workspace)
    assert resposta.status_code == 200
    assert resposta.text.splitlines()[0].startswith("﻿SKU;Produto")
