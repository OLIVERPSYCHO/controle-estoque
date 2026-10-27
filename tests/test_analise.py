from datetime import date

from estoque.analise import consumo_medio_diario, curva_abc, dias_de_cobertura, serie_diaria, status_estoque


def test_status_estoque():
    assert status_estoque(0, 10) == "zerado"
    assert status_estoque(10, 10) == "baixo"
    assert status_estoque(11, 10) == "ok"


def test_dias_de_cobertura():
    assert consumo_medio_diario(60, 30) == 2
    assert dias_de_cobertura(10, 2) == 5
    assert dias_de_cobertura(10, 0) is None


def test_curva_abc_classifica_pelo_valor_acumulado():
    classes = curva_abc({1: 700, 2: 150, 3: 100, 4: 50, 5: 0})
    assert classes == {1: "A", 2: "A", 3: "B", 4: "C", 5: "C"}


def test_curva_abc_sem_consumo():
    assert curva_abc({1: 0, 2: 0}) == {1: "C", 2: "C"}


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
