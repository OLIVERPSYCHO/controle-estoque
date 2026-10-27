export type StatusEstoque = 'ok' | 'baixo' | 'zerado'
export type TipoMovimentacao = 'entrada' | 'saida'

export interface ProdutoDados {
  sku: string
  nome: string
  categoria: string
  unidade: string
  estoque_minimo: number
  custo_unitario: number
}

export interface Produto extends ProdutoDados {
  id: number
  saldo: number
  status: StatusEstoque
  valor_em_estoque: number
}

export interface NovaMovimentacao {
  produto_id: number
  tipo: TipoMovimentacao
  quantidade: number
  observacao: string
}

export interface Movimentacao extends NovaMovimentacao {
  id: number
  produto_nome: string
  produto_sku: string
  criado_em: string
}

export interface Painel {
  indicadores: {
    total_produtos: number
    valor_em_estoque: number
    itens_abaixo_minimo: number
    itens_zerados: number
    saidas_30_dias: number
    entradas_30_dias: number
  }
  serie: { dia: string; entradas: number; saidas: number }[]
  alertas: {
    produto_id: number
    sku: string
    nome: string
    saldo: number
    estoque_minimo: number
    consumo_medio_diario: number
    dias_de_cobertura: number | null
    status: StatusEstoque
  }[]
  curva_abc: { produto_id: number; sku: string; nome: string; valor_consumido: number; classe: 'A' | 'B' | 'C' }[]
  resumo_abc: { classe: 'A' | 'B' | 'C'; itens: number; valor: number }[]
}
