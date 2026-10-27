from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ProdutoEntrada(BaseModel):
    sku: str = Field(min_length=1, max_length=40)
    nome: str = Field(min_length=2, max_length=120)
    categoria: str = Field(min_length=1, max_length=60)
    unidade: str = Field(default="un", min_length=1, max_length=10)
    estoque_minimo: int = Field(default=0, ge=0)
    custo_unitario: float = Field(default=0, ge=0)

    @field_validator("sku", "nome", "categoria", "unidade")
    @classmethod
    def tirar_espacos(cls, valor):
        valor = valor.strip()
        if not valor:
            raise ValueError("campo obrigatório")
        return valor


class ProdutoSaida(ProdutoEntrada):
    id: int
    saldo: int
    status: str
    valor_em_estoque: float


class MovimentacaoEntrada(BaseModel):
    produto_id: int
    tipo: Literal["entrada", "saida"]
    quantidade: int = Field(gt=0, le=1000000)
    observacao: str = Field(default="", max_length=200)


class MovimentacaoSaida(BaseModel):
    id: int
    produto_id: int
    produto_nome: str
    produto_sku: str
    tipo: str
    quantidade: int
    observacao: str
    criado_em: datetime


class Indicadores(BaseModel):
    total_produtos: int
    valor_em_estoque: float
    itens_abaixo_minimo: int
    itens_zerados: int
    entradas_30_dias: int
    saidas_30_dias: int


class DiaSerie(BaseModel):
    dia: date
    entradas: int
    saidas: int


class Alerta(BaseModel):
    produto_id: int
    sku: str
    nome: str
    saldo: int
    estoque_minimo: int
    consumo_medio_diario: float
    dias_de_cobertura: float | None
    status: str


class ItemAbc(BaseModel):
    produto_id: int
    sku: str
    nome: str
    valor_consumido: float
    classe: str


class ResumoAbc(BaseModel):
    classe: str
    itens: int
    valor: float


class Painel(BaseModel):
    indicadores: Indicadores
    serie: list[DiaSerie]
    alertas: list[Alerta]
    curva_abc: list[ItemAbc]
    resumo_abc: list[ResumoAbc]
