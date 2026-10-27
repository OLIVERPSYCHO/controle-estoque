export type StatusEstoque = 'ok' | 'baixo' | 'zerado'
export type SituacaoValidade = 'ok' | 'vencendo' | 'vencido' | 'sem_validade'
export type TipoMovimentacao = 'entrada' | 'saida'

export interface Filial {
  id: number
  nome: string
}

export interface Fornecedor {
  id: number
  nome: string
  cnpj: string
  telefone: string
  email: string
  cidade: string
  prazo_entrega_dias: number
  total_produtos: number
}

export type FornecedorDados = Omit<Fornecedor, 'id' | 'total_produtos'>

export interface ProdutoDados {
  ean: string
  nome: string
  marca: string
  categoria: string
  descricao: string
  peso: string
  qtd_por_fardo: number
  validade_dias: number
  custo: number
  preco_varejo: number
  preco_atacado: number
  qtd_minima_atacado: number
  estoque_minimo: number
  fornecedor_id: number | null
  imagem_url: string
}

export interface Produto extends ProdutoDados {
  id: number
  tem_imagem: boolean
  saldo: number
  status: StatusEstoque
  proxima_validade: string | null
  fornecedor_nome: string
}

export interface Lote {
  id: number
  codigo: string
  filial_id: number
  filial_nome: string
  validade: string | null
  saldo: number
  situacao: SituacaoValidade
}

export interface Movimentacao {
  id: number
  produto_id: number
  produto_nome: string
  produto_ean: string
  filial_nome: string
  lote_codigo: string
  tipo: TipoMovimentacao
  motivo: string
  quantidade: number
  observacao: string
  criado_em: string
}

export interface ProdutoDetalhe extends Produto {
  lotes: Lote[]
  movimentacoes: Movimentacao[]
  saldo_por_filial: Record<string, number>
}

export interface NovaMovimentacao {
  produto_id: number
  filial_id: number
  tipo: TipoMovimentacao
  motivo: string
  quantidade: number
  observacao: string
  lote_codigo?: string
  validade?: string | null
  lote_id?: number | null
}

export interface LoteValidade {
  lote_id: number
  lote_codigo: string
  validade: string
  dias_para_vencer: number
  situacao: SituacaoValidade
  saldo: number
  valor: number
  filial_id: number
  filial_nome: string
  produto_id: number
  produto_nome: string
  produto_ean: string
  tem_imagem: boolean
  imagem_url: string
}

export interface ItemSugestao {
  produto_id: number
  produto_nome: string
  produto_ean: string
  saldo: number
  a_caminho: number
  consumo_diario: number
  dias_de_cobertura: number | null
  qtd_por_fardo: number
  quantidade: number
  custo: number
}

export interface SugestaoFornecedor {
  fornecedor_id: number
  fornecedor_nome: string
  prazo_entrega_dias: number
  itens: ItemSugestao[]
}

export interface PedidoItem {
  id: number
  produto_id: number
  produto_nome: string
  produto_ean: string
  qtd_por_fardo: number
  validade_dias: number
  quantidade: number
  custo: number
}

export interface Pedido {
  id: number
  fornecedor_id: number
  fornecedor_nome: string
  filial_id: number
  filial_nome: string
  status: 'aberto' | 'recebido' | 'cancelado'
  observacao: string
  criado_em: string
  recebido_em: string | null
  total: number
  itens: PedidoItem[]
}

export interface Painel {
  indicadores: {
    total_produtos: number
    valor_em_estoque: number
    faturamento_30_dias: number
    abaixo_minimo: number
    lotes_vencidos: number
    valor_vencido: number
    lotes_vencendo: number
    valor_vencendo: number
    pedidos_abertos: number
  }
  serie: { dia: string; entradas: number; saidas: number }[]
  ruptura: {
    produto_id: number
    nome: string
    ean: string
    saldo: number
    estoque_minimo: number
    consumo_diario: number
    dias_de_cobertura: number | null
    status: StatusEstoque
  }[]
  resumo_abc: { classe: 'A' | 'B' | 'C'; itens: number; valor: number; percentual: number }[]
  mais_vendidos: { produto_id: number; nome: string; quantidade: number; faturamento: number; classe: string }[]
}

export interface ResultadoCodigoBarras {
  ean: string
  nome: string
  marca: string
  peso: string
  imagem_url: string
}
