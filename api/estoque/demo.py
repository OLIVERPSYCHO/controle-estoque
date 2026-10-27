"""Gera os dados de exemplo: 2 filiais, fornecedores, produtos reais (fotos do Open Food Facts)
e 60 dias de vendas, compras e lotes com validade."""

import random
from datetime import datetime, time, timedelta, timezone

from sqlalchemy import insert

from .db import Filial, Fornecedor, Lote, Movimentacao, Pedido, PedidoItem, Produto
from .estoque import FUSO_BRASILIA

DIAS = 60

FILIAIS = [("Palhoça - SC", 1.0), ("São José - SC", 0.7)]  # nome, tamanho das vendas comparado a Palhoça

# empresas fictícias
FORNECEDORES = {
    "litoral": ("Distribuidora Litoral Catarinense Ltda", "Itajaí - SC", "(47) 3300-1000", "pedidos@litoralcatarinense.com.br", 4),
    "bebidas": ("Grande Floripa Distribuidora de Bebidas", "São José - SC", "(48) 3200-2000", "vendas@grandefloripabebidas.com.br", 2),
    "frios": ("Serra Sul Frios e Laticínios", "Lages - SC", "(49) 3220-3000", "comercial@serrasulfrios.com.br", 3),
    "mercearia": ("Sul Mercearia Atacadista", "Tubarão - SC", "(48) 3620-5000", "compras@sulmercearia.com.br", 6),
}

OFF = "https://images.openfoodfacts.org/images/products/"

# ean, nome, marca, categoria, peso, unidades por fardo, validade (dias), custo, preço varejo, preço atacado,
# venda média por dia em Palhoça (un), fornecedor, imagem, descrição
PRODUTOS = [
    ("7896070800014", "Feijão Carioca Tipo 1 Pantera 1kg", "Pantera", "Mercearia", "1 kg", 10, 365, 6.20, 8.49, 7.69, 18, "litoral",
     "789/607/080/0014/front_pt.3.400.jpg", "Feijão carioca tipo 1, grãos selecionados. Pacote de 1 kg."),
    ("7890300155929", "Feijão Preto Fritz & Frida 1kg", "Fritz & Frida", "Mercearia", "1 kg", 10, 365, 6.80, 8.99, 8.19, 10, "litoral",
     "789/030/015/5929/front_pt.6.400.jpg", "Feijão preto tipo 1. Pacote de 1 kg."),
    ("7896036090244", "Óleo de Soja Liza 900ml", "Liza", "Mercearia", "900 ml", 20, 365, 6.10, 7.99, 7.29, 25, "litoral",
     "789/603/609/0244/front_pt.11.400.jpg", "Óleo de soja refinado tipo 1. Garrafa PET de 900 ml."),
    ("7896279600538", "Óleo de Soja Coamo 900ml", "Coamo", "Mercearia", "900 ml", 20, 365, 5.70, 7.49, 6.89, 15, "litoral",
     "789/627/960/0538/front_pt.23.400.jpg", "Óleo de soja refinado. Garrafa PET de 900 ml."),
    ("7891021006125", "Café Melitta Tradicional 500g", "Melitta", "Mercearia", "500 g", 10, 270, 17.90, 23.90, 21.90, 12, "litoral",
     "789/102/100/6125/front_pt.38.400.jpg", "Café torrado e moído tradicional. Embalagem a vácuo de 500 g."),
    ("7896089012637", "Café Pilão Tradicional 250g", "Pilão", "Mercearia", "250 g", 20, 270, 9.80, 12.99, 11.89, 9, "litoral",
     "789/608/901/2637/front_pt.9.400.jpg", "Café torrado e moído tradicional. Embalagem a vácuo de 250 g."),
    ("7896090082056", "Farinha de Trigo Finna 1kg", "Finna", "Mercearia", "1 kg", 10, 180, 3.60, 4.99, 4.49, 12, "litoral",
     "789/609/008/2056/front_pt.4.400.jpg", "Farinha de trigo sem fermento. Pacote de 1 kg."),
    ("7896029310014", "Sal Refinado Globo 1kg", "Globo", "Mercearia", "1 kg", 30, 1095, 1.40, 2.29, 1.99, 8, "litoral",
     "789/602/931/0014/front_pt.3.400.jpg", "Sal refinado iodado. Pacote de 1 kg."),
    ("7896022200206", "Macarrão Parafuso com Ovos Renata 500g", "Renata", "Massas e Molhos", "500 g", 20, 540, 3.40, 4.79, 4.29, 14, "mercearia",
     "789/602/220/0206/front_pt.6.400.jpg", "Massa de sêmola com ovos, formato parafuso. Pacote de 500 g."),
    ("7891079000212", "Macarrão Instantâneo Nissin Miojo Galinha 85g", "Nissin", "Massas e Molhos", "85 g", 50, 240, 1.05, 1.69, 1.45, 40, "mercearia",
     "789/107/900/0212/front_pt.4.400.jpg", "Macarrão instantâneo sabor galinha. Pacote de 85 g."),
    ("7897517206086", "Molho de Tomate Fugini Tradicional 300g", "Fugini", "Massas e Molhos", "300 g", 24, 365, 1.30, 2.19, 1.89, 20, "mercearia",
     "789/751/720/6086/front_pt.27.400.jpg", "Molho de tomate tradicional. Sachê de 300 g."),
    ("7894321711171", "Achocolatado Toddy Original 200g", "Toddy", "Mercearia", "200 g", 24, 365, 5.10, 6.99, 6.29, 6, "mercearia",
     "789/432/171/1171/front_pt.42.400.jpg", "Achocolatado em pó original. Pote de 200 g."),
    ("7894900027013", "Refrigerante Coca-Cola 2L", "Coca-Cola", "Bebidas", "2 L", 6, 150, 7.20, 9.99, 8.99, 30, "bebidas",
     "789/490/002/7013/front_pt.60.400.jpg", "Refrigerante de cola. Garrafa PET de 2 litros."),
    ("7894900010015", "Refrigerante Coca-Cola Lata 350ml", "Coca-Cola", "Bebidas", "350 ml", 12, 180, 2.70, 3.99, 3.49, 36, "bebidas",
     "789/490/001/0015/front_pt.54.400.jpg", "Refrigerante de cola. Lata de 350 ml."),
    ("7891991000727", "Guaraná Antarctica Zero Lata 350ml", "Antarctica", "Bebidas", "350 ml", 12, 180, 2.30, 3.49, 2.99, 15, "bebidas",
     "789/199/100/0727/front_pt.42.400.jpg", "Refrigerante de guaraná sem açúcar. Lata de 350 ml."),
    ("7894900530032", "Água Mineral Crystal sem Gás 1,5L", "Crystal", "Bebidas", "1,5 L", 6, 365, 1.60, 2.79, 2.29, 24, "bebidas",
     "789/490/053/0032/front_pt.21.400.jpg", "Água mineral natural sem gás. Garrafa de 1,5 litro."),
    ("7894900530001", "Água Mineral Crystal sem Gás 500ml", "Crystal", "Bebidas", "500 ml", 12, 365, 0.95, 1.79, 1.49, 30, "bebidas",
     "789/490/053/0001/front_pt.30.400.jpg", "Água mineral natural sem gás. Garrafa de 500 ml."),
    ("7893000394209", "Margarina Qualy Cremosa com Sal 500g", "Qualy", "Frios e Laticínios", "500 g", 12, 150, 6.30, 8.49, 7.79, 10, "frios",
     "789/300/039/4209/front_pt.21.400.jpg", "Margarina cremosa com sal. Pote de 500 g. Manter refrigerado."),
    ("7893000079298", "Margarina Qualy Cremosa com Sal 1kg", "Qualy", "Frios e Laticínios", "1 kg", 12, 150, 11.40, 14.99, 13.79, 3, "frios",
     "789/300/007/9298/front_pt.25.400.jpg", "Margarina cremosa com sal, embalagem econômica. Pote de 1 kg. Manter refrigerado."),
    ("7896584300208", "Arroz Parboilizado Tipo 1 Fantástico 5kg", "Fantástico", "Mercearia", "5 kg", 6, 365, 19.90, 26.90, 24.50, 14, "litoral",
     "789/658/430/0208/front_pt.4.400.jpg", "Arroz parboilizado tipo 1, grãos soltinhos. Pacote de 5 kg."),
    ("7891910000197", "Açúcar Refinado União 1kg", "União", "Mercearia", "1 kg", 10, 730, 3.90, 5.29, 4.79, 16, "litoral",
     "789/191/000/0197/front.6.400.jpg", "Açúcar refinado. Pacote de 1 kg."),
    ("7898080640611", "Leite UHT Integral Italac 1L", "Italac", "Frios e Laticínios", "1 L", 12, 120, 4.30, 5.79, 5.29, 40, "frios",
     "789/808/064/0611/front_pt.24.400.jpg", "Leite integral UHT (longa vida). Caixa de 1 litro."),
    ("7898215151708", "Leite UHT Integral Piracanjuba 1L", "Piracanjuba", "Frios e Laticínios", "1 L", 12, 120, 4.60, 6.19, 5.59, 25, "frios",
     "789/821/515/1708/front.3.400.jpg", "Leite integral UHT (longa vida). Caixa de 1 litro."),
    ("7898215151784", "Creme de Leite Piracanjuba 200g", "Piracanjuba", "Frios e Laticínios", "200 g", 27, 180, 2.40, 3.49, 2.99, 12, "frios",
     "789/821/515/1784/front_pt.20.400.jpg", "Creme de leite UHT. Caixinha de 200 g."),
    ("7896003703177", "Biscoito Cream Cracker Integral Marilan 420g", "Marilan", "Biscoitos", "420 g", 20, 240, 4.10, 5.79, 5.19, 8, "mercearia",
     "789/600/370/3177/front_pt.13.400.jpg", "Biscoito cream cracker integral. Pacote de 420 g."),
    ("7891000412855", "Achocolatado Nescau 350g", "Nestlé", "Mercearia", "350 g", 24, 365, 7.30, 9.79, 8.99, 7, "mercearia",
     "789/100/041/2855/front_pt.21.400.jpg", "Achocolatado em pó. Lata de 350 g."),
    ("7896045523412", "Cerveja Heineken Lata 350ml", "Heineken", "Bebidas", "350 ml", 12, 180, 4.20, 5.99, 5.39, 30, "bebidas",
     "789/604/552/3412/front_en.17.400.jpg", "Cerveja puro malte tipo lager. Lata de 350 ml. Venda proibida para menores de 18 anos."),
    ("7891991298407", "Cerveja Budweiser Zero Álcool Lata 350ml", "Budweiser", "Bebidas", "350 ml", 12, 180, 3.40, 4.79, 4.29, 6, "bebidas",
     "789/199/129/8407/front_pt.3.400.jpg", "Cerveja sem álcool. Lata de 350 ml."),
    ("7898341430098", "Néctar de Uva Del Valle 1L", "Del Valle", "Bebidas", "1 L", 6, 240, 5.20, 7.49, 6.79, 8, "bebidas",
     "789/834/143/0098/front_pt.18.400.jpg", "Néctar de uva. Caixa de 1 litro."),
]

# cenários para o painel ter alertas (sku: o que acontece)
PARA_REPOSICAO = {"7891021006125": 25, "7896022200206": 20}  # para de repor nos últimos N dias -> estoque baixo/zerado
VENCENDO = {"7893000079298": 12, "7894321711171": 20}  # lote com validade curta que vence em N dias
PEDIDO_A_CAMINHO = "7891021006125"  # produto zerado que já foi pedido e ainda não chegou
VENCIDO = {"7893000394209": 3}  # devolução de cliente vencida há N dias


def sortear_venda(media, fator):
    return max(0, round(media * fator * random.uniform(0.55, 1.45)))


def criar_dados_demo(session, workspace_id):
    agora = datetime.now(timezone.utc)
    hoje = agora.astimezone(FUSO_BRASILIA).date()
    inicio = hoje - timedelta(days=DIAS)

    def momento(dia, hora):
        # dia (date) + hora local -> datetime em UTC
        return datetime.combine(dia, time(hora, random.randint(0, 59)), FUSO_BRASILIA).astimezone(timezone.utc)

    filiais = []
    for nome, _ in FILIAIS:
        filial = Filial(workspace_id=workspace_id, nome=nome)
        session.add(filial)
        filiais.append(filial)

    fornecedores = {}
    for chave, (nome, cidade, telefone, email, prazo) in FORNECEDORES.items():
        fornecedor = Fornecedor(workspace_id=workspace_id, nome=nome, cidade=cidade, telefone=telefone,
                                email=email, prazo_entrega_dias=prazo)
        session.add(fornecedor)
        fornecedores[chave] = fornecedor
    session.flush()

    produtos = []
    for (ean, nome, marca, categoria, peso, fardo, validade, custo, varejo, atacado, venda_dia, forn,
         imagem, descricao) in PRODUTOS:
        produto = Produto(
            workspace_id=workspace_id, ean=ean, nome=nome, marca=marca, categoria=categoria, descricao=descricao,
            peso=peso, qtd_por_fardo=fardo, validade_dias=validade, custo=custo, preco_varejo=varejo,
            preco_atacado=atacado, qtd_minima_atacado=fardo, estoque_minimo=int(venda_dia * 4),
            fornecedor_id=fornecedores[forn].id, imagem_url=OFF + imagem,
        )
        session.add(produto)
        produtos.append((produto, venda_dia, forn))
    session.flush()

    movimentos = []  # linhas para inserir de uma vez no final (bem mais rápido)
    pedidos = []  # (pedido, [(produto, quantidade, lote)])

    for filial, (_, fator) in zip(filiais, FILIAIS):
        # os lotes de cada produto ficam em memória: [lote, validade, saldo, dia que chegou]
        reposicoes_por_dia = {}  # (dia, fornecedor) -> lista de (produto, quantidade, dia_validade)

        for produto, venda_dia, forn in produtos:
            lotes = []
            pedido_chega_em = None  # enquanto tem pedido a caminho não pede de novo
            minimo = int(produto.estoque_minimo * fator)
            # compra para uns 20 dias, em fardo fechado
            lote_compra = max(1, round(venda_dia * fator * 20 / produto.qtd_por_fardo)) * produto.qtd_por_fardo

            def entrada(dia, quantidade, codigo, validade, motivo="compra", obs=""):
                lote = Lote(workspace_id=workspace_id, produto_id=produto.id, filial_id=filial.id, codigo=codigo,
                            validade=validade, criado_em=momento(dia, 7))
                session.add(lote)
                lotes.append([lote, validade, quantidade, dia])
                movimentos.append({"produto_id": produto.id, "lote": lote, "tipo": "entrada", "motivo": motivo,
                                   "quantidade": quantidade, "observacao": obs, "criado_em": momento(dia, 7)})

            # saldo inicial: fabricado uns dias antes de chegar
            fabricado = inicio - timedelta(days=random.randint(5, 40))
            entrada(inicio, lote_compra + minimo, f"L{fabricado:%y%m%d}",
                    fabricado + timedelta(days=produto.validade_dias), "ajuste", "Saldo inicial (inventário)")

            if produto.ean in VENCENDO:
                # comprou numa promoção do fornecedor um lote com validade curta
                dia = hoje - timedelta(days=8)
                entrada(dia, produto.qtd_por_fardo * 6, f"L{dia:%y%m%d}P", hoje + timedelta(days=VENCENDO[produto.ean]),
                        "compra", "Compra em promoção (validade curta)")

            for n in range(1, DIAS + 1):
                dia = inicio + timedelta(days=n)
                if dia > hoje:
                    break

                # vendas do dia, tirando do lote que vence antes (FEFO)
                # fim de semana vende menos no atacado
                venda = sortear_venda(venda_dia, fator * (0.6 if dia.weekday() >= 5 else 1))
                if dia == hoje:
                    venda = venda // 2  # o dia ainda não acabou
                validos = sorted([l for l in lotes if l[2] > 0 and l[1] >= dia and l[3] <= dia], key=lambda l: l[1])
                for lote in validos:
                    if venda == 0:
                        break
                    tirar = min(venda, lote[2])
                    lote[2] -= tirar
                    venda -= tirar
                    movimentos.append({"produto_id": produto.id, "lote": lote[0], "tipo": "saida", "motivo": "venda",
                                       "quantidade": tirar, "observacao": "", "criado_em": momento(dia, random.randint(8, 17))})

                saldo = sum(l[2] for l in lotes if l[1] >= dia and l[3] <= dia)
                parou = produto.ean in PARA_REPOSICAO and dia > hoje - timedelta(days=PARA_REPOSICAO[produto.ean])
                a_caminho = pedido_chega_em is not None and pedido_chega_em > dia
                if saldo <= minimo and not parou and not a_caminho and dia < hoje:
                    # o pedido chega depois do prazo do fornecedor
                    chegada = dia + timedelta(days=FORNECEDORES[forn][4])
                    pedido_chega_em = chegada
                    reposicoes_por_dia.setdefault((dia, forn), []).append((produto, lote_compra, chegada))
                    if chegada <= hoje:
                        fabricado = chegada - timedelta(days=random.randint(3, 25))
                        entrada(chegada, lote_compra, f"L{fabricado:%y%m%d}",
                                fabricado + timedelta(days=produto.validade_dias), "compra", "PEDIDO")

            if produto.ean in VENCIDO:
                dia = hoje - timedelta(days=6)
                entrada(dia, 6, "DEV-0412", hoje - timedelta(days=VENCIDO[produto.ean]), "devolucao",
                        "Devolução de cliente")

        # agrupa as reposições do mesmo dia e fornecedor num pedido de compra
        for (dia, forn), itens in sorted(reposicoes_por_dia.items(), key=lambda x: x[0][0]):
            chegada = dia + timedelta(days=FORNECEDORES[forn][4])
            pedido = Pedido(workspace_id=workspace_id, fornecedor_id=fornecedores[forn].id, filial_id=filial.id,
                            status="recebido" if chegada <= hoje else "aberto", criado_em=momento(dia, 18),
                            recebido_em=momento(chegada, 7) if chegada <= hoje else None)
            session.add(pedido)
            pedidos.append((pedido, itens))

    # um pedido em aberto na primeira filial, para dar para testar o recebimento
    cafe = next(p for p, _, _ in produtos if p.ean == PEDIDO_A_CAMINHO)
    ontem = hoje - timedelta(days=1)
    pedido = Pedido(workspace_id=workspace_id, fornecedor_id=cafe.fornecedor_id, filial_id=filiais[0].id,
                    status="aberto", observacao="Pedido feito por telefone", criado_em=momento(ontem, 10))
    session.add(pedido)
    pedidos.append((pedido, [(cafe, cafe.qtd_por_fardo * 12, None)]))

    session.flush()  # gera os ids dos lotes e pedidos

    for pedido, itens in pedidos:
        for produto, quantidade, _ in itens:
            session.add(PedidoItem(pedido_id=pedido.id, produto_id=produto.id, quantidade=quantidade,
                                   custo=produto.custo))

    # liga as entradas "PEDIDO" ao número do pedido
    pedido_por_chegada = {}
    for pedido, itens in pedidos:
        for produto, _, chegada in itens:
            pedido_por_chegada[(pedido.filial_id, produto.id, chegada)] = pedido.id

    linhas = []
    for m in movimentos:
        lote = m.pop("lote")
        observacao = m["observacao"]
        if observacao == "PEDIDO":
            dia = m["criado_em"].astimezone(FUSO_BRASILIA).date()
            numero = pedido_por_chegada.get((lote.filial_id, m["produto_id"], dia))
            observacao = f"Pedido de compra #{numero}" if numero else "Compra"
        linhas.append({**m, "observacao": observacao, "workspace_id": workspace_id, "filial_id": lote.filial_id,
                       "lote_id": lote.id})
    session.execute(insert(Movimentacao), linhas)
