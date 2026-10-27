from datetime import date

from estoque.analise import (
    consumo_medio_diario, curva_abc, dias_de_cobertura, escolher_lotes_fefo, serie_diaria,
    situacao_validade, status_estoque, sugestao_de_compra,
)

HOJE = date(2026, 6, 10)


def test_status_estoque():
    assert status_estoque(0, 10) == "zerado"
    assert status_estoque(10, 10) == "baixo"
    assert status_estoque(11, 10) == "ok"


def test_dias_de_cobertura():
    assert consumo_medio_diario(60, 30) == 2
    assert dias_de_cobertura(10, 2) == 5
    assert dias_de_cobertura(10, 0) is None


def test_situacao_validade():
    assert situacao_validade(None, HOJE) == "sem_validade"
    assert situacao_validade(date(2026, 6, 9), HOJE) == "vencido"
    assert situacao_validade(date(2026, 6, 25), HOJE) == "vencendo"
    assert situacao_validade(date(2026, 9, 1), HOJE) == "ok"


def test_fefo_tira_primeiro_do_que_vence_antes():
    lotes = [(1, date(2026, 8, 1), 10), (2, date(2026, 7, 1), 5), (3, None, 50)]
    assert escolher_lotes_fefo(lotes, 8, HOJE) == [(2, 5), (1, 3)]


def test_fefo_ignora_lote_vencido():
    lotes = [(1, date(2026, 6, 1), 30), (2, date(2026, 7, 1), 5)]
    assert escolher_lotes_fefo(lotes, 5, HOJE) == [(2, 5)]
    assert escolher_lotes_fefo(lotes, 6, HOJE) is None


def test_sugestao_de_compra_arredonda_para_fardo():
    # ponto de pedido = 2/dia * 5 dias + 10 = 20
    # tem 20 -> compra 20 + 2 * 20 dias - 20 = 40 -> 4 fardos de 12 = 48
    assert sugestao_de_compra(20, 2, 10, 5, 12) == 48


def test_sugestao_de_compra_so_no_ponto_de_pedido():
    assert sugestao_de_compra(21, 2, 10, 5, 12) == 0
    assert sugestao_de_compra(0, 0, 10, 5, 12) == 12  # sem venda mas abaixo do mínimo: completa o mínimo


def test_curva_abc_classifica_pelo_valor_acumulado():
    classes = curva_abc({1: 700, 2: 150, 3: 100, 4: 50, 5: 0})
    assert classes == {1: "A", 2: "A", 3: "B", 4: "C", 5: "C"}


def test_serie_diaria_preenche_dias_sem_movimento():
    serie = serie_diaria(
        [(date(2026, 1, 10), "entrada", 5), (date(2026, 1, 10), "saida", 2), (date(2026, 1, 1), "saida", 9)],
        hoje=date(2026, 1, 10),
        dias=3,
    )
    assert [d["dia"] for d in serie] == [date(2026, 1, 8), date(2026, 1, 9), date(2026, 1, 10)]
    assert serie[-1]["entradas"] == 5
    assert serie[-1]["saidas"] == 2
    assert serie[0]["entradas"] == 0
