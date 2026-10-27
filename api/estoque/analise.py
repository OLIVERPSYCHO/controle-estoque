import math
from datetime import timedelta


def status_estoque(saldo, estoque_minimo):
    if saldo <= 0:
        return "zerado"
    if saldo <= estoque_minimo:
        return "baixo"
    return "ok"


def consumo_medio_diario(total_saidas, dias):
    if dias <= 0:
        return 0.0
    return total_saidas / dias


def dias_de_cobertura(saldo, consumo_diario):
    # quantos dias o estoque dura no ritmo atual
    if consumo_diario <= 0:
        return None
    return max(saldo, 0) / consumo_diario


def situacao_validade(validade, hoje, dias_alerta=30):
    if validade is None:
        return "sem_validade"
    if validade < hoje:
        return "vencido"
    if validade <= hoje + timedelta(days=dias_alerta):
        return "vencendo"
    return "ok"


def escolher_lotes_fefo(lotes, quantidade, hoje):
    """FEFO: tira primeiro do lote que vence antes. Lote vencido não pode ser vendido.

    lotes = lista de (lote_id, validade, saldo)
    devolve lista de (lote_id, quantidade) ou None se não tiver saldo suficiente
    """
    disponiveis = [lote for lote in lotes if lote[2] > 0 and (lote[1] is None or lote[1] >= hoje)]
    # lote sem validade vai pro final
    disponiveis.sort(key=lambda lote: (lote[1] is None, lote[1] or hoje, lote[0]))

    retirar = []
    falta = quantidade
    for lote_id, _validade, saldo in disponiveis:
        if falta == 0:
            break
        tirar = min(saldo, falta)
        retirar.append((lote_id, tirar))
        falta -= tirar

    if falta > 0:
        return None
    return retirar


def ponto_de_pedido(consumo_diario, estoque_minimo, prazo_entrega):
    # o que vai ser vendido enquanto o pedido não chega + a reserva mínima
    return consumo_diario * prazo_entrega + estoque_minimo


def sugestao_de_compra(saldo, consumo_diario, estoque_minimo, prazo_entrega, qtd_por_fardo, dias_de_estoque=20):
    """Se o saldo chegou no ponto de pedido, compra o suficiente para mais `dias_de_estoque` dias.
    Arredonda para fardo fechado."""
    ponto = ponto_de_pedido(consumo_diario, estoque_minimo, prazo_entrega)
    if saldo > ponto:
        return 0
    falta = ponto + consumo_diario * dias_de_estoque - max(saldo, 0)
    fardo = max(qtd_por_fardo, 1)
    return math.ceil(falta / fardo) * fardo


def curva_abc(valores):
    # valores = {produto_id: valor vendido}
    # A = itens que somam os primeiros 80% do valor, B = até 95%, C = resto
    total = sum(valores.values())
    classes = {}
    if total <= 0:
        for produto_id in valores:
            classes[produto_id] = "C"
        return classes

    acumulado = 0
    ordenados = sorted(valores.items(), key=lambda item: item[1], reverse=True)
    for produto_id, valor in ordenados:
        percentual = acumulado / total
        if valor <= 0:
            classes[produto_id] = "C"
        elif percentual < 0.80:
            classes[produto_id] = "A"
        elif percentual < 0.95:
            classes[produto_id] = "B"
        else:
            classes[produto_id] = "C"
        acumulado += valor
    return classes


def serie_diaria(movimentos, hoje, dias):
    # movimentos = lista de (dia, tipo, quantidade)
    inicio = hoje - timedelta(days=dias - 1)
    serie = {}
    for i in range(dias):
        dia = inicio + timedelta(days=i)
        serie[dia] = {"dia": dia, "entradas": 0, "saidas": 0}

    for dia, tipo, quantidade in movimentos:
        if dia not in serie:
            continue
        if tipo == "entrada":
            serie[dia]["entradas"] += quantidade
        else:
            serie[dia]["saidas"] += quantidade

    return list(serie.values())
