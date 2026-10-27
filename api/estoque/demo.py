import random
from datetime import datetime, timedelta, timezone

from .db import Movimentacao, Produto

# sku, nome, categoria, unidade, estoque minimo, custo, consumo medio por dia
PRODUTOS_DEMO = [
    ("EMB-001", "Caixa de papelão 30x20x15", "Embalagens", "un", 150, 2.40, 22),
    ("EMB-002", "Caixa de papelão 50x40x30", "Embalagens", "un", 80, 4.90, 9),
    ("EMB-003", "Fita adesiva transparente 48mm", "Embalagens", "rl", 60, 6.50, 7),
    ("EMB-004", "Plástico bolha 1,20m x 100m", "Embalagens", "rl", 6, 89.90, 0.6),
    ("EMB-005", "Etiqueta térmica 100x150", "Embalagens", "rl", 20, 24.00, 2.5),
    ("EPI-001", "Luva de proteção nitrílica", "EPI", "par", 40, 7.80, 4),
    ("EPI-002", "Bota de segurança", "EPI", "par", 5, 119.00, 0.25),
    ("EPI-003", "Óculos de proteção", "EPI", "un", 10, 15.90, 0.8),
    ("EPI-004", "Protetor auricular", "EPI", "un", 30, 3.20, 3),
    ("FER-001", "Estilete profissional", "Ferramentas", "un", 12, 18.50, 0.7),
    ("FER-002", "Paleteira manual 2,5t", "Ferramentas", "un", 1, 2490.00, 0.02),
    ("FER-003", "Trena 5m", "Ferramentas", "un", 4, 29.90, 0.15),
    ("FER-004", "Lâmina para estilete", "Ferramentas", "cx", 15, 12.00, 1.6),
    ("LIM-001", "Detergente neutro 5L", "Limpeza", "gl", 8, 32.00, 0.6),
    ("LIM-002", "Pano de limpeza", "Limpeza", "un", 25, 3.50, 2.2),
    ("LIM-003", "Saco de lixo 100L", "Limpeza", "pct", 15, 19.90, 1.2),
    ("ESC-001", "Papel A4 (resma)", "Escritório", "un", 10, 27.90, 0.9),
    ("ESC-002", "Caneta esferográfica azul", "Escritório", "cx", 3, 38.00, 0.12),
    ("ESC-003", "Toner para impressora", "Escritório", "un", 2, 189.00, 0.07),
    ("ELE-001", "Pilha AA (pacote com 4)", "Eletrônicos", "pct", 10, 16.90, 0.7),
    ("ELE-002", "Leitor de código de barras", "Eletrônicos", "un", 1, 349.00, 0.01),
    ("ELE-003", "Bateria para coletor de dados", "Eletrônicos", "un", 3, 159.00, 0.08),
]

DIAS = 90

# produtos que param de ser repostos no fim (sku: dias sem reposição),
# assim o painel sempre tem itens zerados e abaixo do mínimo
SEM_REPOSICAO = {"EMB-003": 50, "FER-004": 50, "EPI-004": 25, "ESC-001": 30}


def sortear_demanda(consumo_medio):
    if consumo_medio < 1:
        # item que sai pouco: as vezes sai 1, as vezes nada
        return 1 if random.random() < consumo_medio else 0
    return round(consumo_medio * random.uniform(0.5, 1.5))


def criar_dados_demo(session, workspace_id):
    inicio = datetime.now(timezone.utc) - timedelta(days=DIAS)

    for sku, nome, categoria, unidade, minimo, custo, consumo in PRODUTOS_DEMO:
        produto = Produto(
            workspace_id=workspace_id,
            sku=sku,
            nome=nome,
            categoria=categoria,
            unidade=unidade,
            estoque_minimo=minimo,
            custo_unitario=custo,
            criado_em=inicio,
        )
        session.add(produto)
        session.flush()  # para ter o produto.id

        lote = max(int(consumo * 30), minimo * 2, 1)
        saldo = lote + minimo
        session.add(Movimentacao(
            workspace_id=workspace_id, produto_id=produto.id, tipo="entrada",
            quantidade=saldo, observacao="Saldo inicial", criado_em=inicio,
        ))

        for dia in range(1, DIAS + 1):
            # volta algumas horas para nunca gerar data no futuro
            data = inicio + timedelta(days=dia) - timedelta(hours=random.randint(2, 12))

            demanda = min(sortear_demanda(consumo), saldo)
            if demanda > 0:
                saldo -= demanda
                session.add(Movimentacao(
                    workspace_id=workspace_id, produto_id=produto.id, tipo="saida",
                    quantidade=demanda, observacao="Consumo da operação", criado_em=data,
                ))

            parou_reposicao = dia > DIAS - SEM_REPOSICAO.get(sku, 0)
            if saldo <= minimo and not parou_reposicao:
                saldo += lote
                session.add(Movimentacao(
                    workspace_id=workspace_id, produto_id=produto.id, tipo="entrada",
                    quantidade=lote, observacao="Reposição de fornecedor",
                    criado_em=data + timedelta(minutes=30),
                ))
