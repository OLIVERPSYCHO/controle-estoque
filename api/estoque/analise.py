from datetime import date, timedelta


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


def curva_abc(valores):
    # valores = {produto_id: valor consumido}
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
