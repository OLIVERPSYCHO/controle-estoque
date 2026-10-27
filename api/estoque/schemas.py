from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class FornecedorEntrada(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    cnpj: str = Field(default="", max_length=20)
    telefone: str = Field(default="", max_length=20)
    email: str = Field(default="", max_length=120)
    cidade: str = Field(default="", max_length=80)
    prazo_entrega_dias: int = Field(default=7, ge=0, le=120)


class FornecedorSaida(FornecedorEntrada):
    id: int
    total_produtos: int = 0


class ProdutoEntrada(BaseModel):
    ean: str = Field(default="", max_length=14)
    nome: str = Field(min_length=2, max_length=150)
    marca: str = Field(default="", max_length=80)
    categoria: str = Field(min_length=1, max_length=60)
    descricao: str = Field(default="", max_length=2000)
    peso: str = Field(default="", max_length=30)
    qtd_por_fardo: int = Field(default=1, ge=1)
    validade_dias: int = Field(default=0, ge=0)
    custo: float = Field(default=0, ge=0)
    preco_varejo: float = Field(default=0, ge=0)
    preco_atacado: float = Field(default=0, ge=0)
    qtd_minima_atacado: int = Field(default=1, ge=1)
    estoque_minimo: int = Field(default=0, ge=0)
    fornecedor_id: int | None = None
    imagem_url: str = Field(default="", max_length=300)

    @field_validator("nome", "categoria")
    @classmethod
    def obrigatorio(cls, valor):
        valor = valor.strip()
        if not valor:
            raise ValueError("campo obrigatório")
        return valor

    @field_validator("ean")
    @classmethod
    def so_numeros(cls, valor):
        valor = valor.strip()
        if valor and not valor.isdigit():
            raise ValueError("o EAN deve ter só números")
        return valor


class ProdutoSaida(ProdutoEntrada):
    id: int
    tem_imagem: bool
    saldo: int
    status: str
    proxima_validade: date | None = None
    fornecedor_nome: str = ""


class LoteSaida(BaseModel):
    id: int
    codigo: str
    filial_id: int
    filial_nome: str
    validade: date | None
    saldo: int
    situacao: str


class MovimentacaoEntrada(BaseModel):
    produto_id: int
    filial_id: int
    tipo: Literal["entrada", "saida"]
    motivo: Literal["compra", "devolucao", "ajuste", "venda", "perda", "avaria", "uso_interno"]
    quantidade: int = Field(gt=0, le=1000000)
    observacao: str = Field(default="", max_length=200)
    # entrada: lote e validade do que chegou; saída: lote específico (se vazio usa FEFO)
    lote_codigo: str = Field(default="", max_length=40)
    validade: date | None = None
    lote_id: int | None = None


class MovimentacaoSaida(BaseModel):
    id: int
    produto_id: int
    produto_nome: str
    produto_ean: str
    filial_nome: str
    lote_codigo: str
    tipo: str
    motivo: str
    quantidade: int
    observacao: str
    criado_em: datetime


class ProdutoDetalhe(ProdutoSaida):
    lotes: list[LoteSaida]
    movimentacoes: list[MovimentacaoSaida]
    saldo_por_filial: dict[str, int]


class ImagemEntrada(BaseModel):
    # "data:image/webp;base64,...."
    imagem: str = Field(max_length=1_500_000)


class PedidoItemEntrada(BaseModel):
    produto_id: int
    quantidade: int = Field(gt=0)
    custo: float = Field(ge=0)


class PedidoEntrada(BaseModel):
    fornecedor_id: int
    filial_id: int
    observacao: str = Field(default="", max_length=200)
    itens: list[PedidoItemEntrada] = Field(min_length=1)


class PedidoItemSaida(BaseModel):
    id: int
    produto_id: int
    produto_nome: str
    produto_ean: str
    qtd_por_fardo: int
    validade_dias: int
    quantidade: int
    custo: float


class PedidoSaida(BaseModel):
    id: int
    fornecedor_id: int
    fornecedor_nome: str
    filial_id: int
    filial_nome: str
    status: str
    observacao: str
    criado_em: datetime
    recebido_em: datetime | None
    total: float
    itens: list[PedidoItemSaida]


class RecebimentoItem(BaseModel):
    item_id: int
    lote_codigo: str = Field(default="", max_length=40)
    validade: date | None = None


class Recebimento(BaseModel):
    itens: list[RecebimentoItem] = []
