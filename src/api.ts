import type {
  Filial, Fornecedor, FornecedorDados, LoteValidade, Movimentacao, NovaMovimentacao, Painel, Pedido,
  Produto, ProdutoDados, ProdutoDetalhe, ResultadoCodigoBarras, SugestaoFornecedor,
} from './types'

const CHAVE = 'controle-estoque:workspace'

let workspaceId: string | null = lerWorkspace()
let criandoWorkspace: Promise<string> | null = null

function lerWorkspace() {
  try {
    return localStorage.getItem(CHAVE)
  } catch {
    return null
  }
}

function salvarWorkspace(id: string | null) {
  try {
    if (id) localStorage.setItem(CHAVE, id)
    else localStorage.removeItem(CHAVE)
  } catch {
    // aba anônima pode bloquear o localStorage, então só não salva
  }
}

async function criarWorkspace() {
  const resposta = await fetch('/api/workspaces', { method: 'POST' })
  if (!resposta.ok) throw new Error('Não foi possível iniciar a demonstração. Tente novamente.')
  const dados = await resposta.json()
  workspaceId = dados.id as string
  salvarWorkspace(workspaceId)
  return workspaceId
}

function pegarWorkspace() {
  if (workspaceId) return Promise.resolve(workspaceId)
  // no primeiro acesso várias telas chamam ao mesmo tempo, então reaproveita a mesma criação
  if (!criandoWorkspace) {
    criandoWorkspace = criarWorkspace().finally(() => {
      criandoWorkspace = null
    })
  }
  return criandoWorkspace
}

async function lerErro(resposta: Response) {
  try {
    const corpo = await resposta.json()
    if (typeof corpo.detail === 'string') return corpo.detail
    if (Array.isArray(corpo.detail)) return 'Confira os campos, há algum valor inválido.'
  } catch {
    // resposta sem json
  }
  return `Erro ${resposta.status}. Tente novamente.`
}

async function requisicao(url: string, opcoes: RequestInit = {}, tentarDeNovo = true): Promise<Response> {
  const id = await pegarWorkspace()
  const resposta = await fetch(url, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', 'X-Workspace-Id': id },
  })
  if (resposta.ok) return resposta

  const mensagem = await lerErro(resposta)
  // o espaço de demonstração expira depois de 14 dias, aí cria outro
  if (resposta.status === 404 && mensagem.startsWith('Espaço de demonstração') && tentarDeNovo) {
    workspaceId = null
    salvarWorkspace(null)
    return requisicao(url, opcoes, false)
  }
  throw new Error(mensagem)
}

async function get<T>(url: string): Promise<T> {
  const resposta = await requisicao(url)
  return resposta.json()
}

async function enviar<T>(metodo: string, url: string, corpo?: unknown): Promise<T> {
  const resposta = await requisicao(url, { method: metodo, body: corpo ? JSON.stringify(corpo) : undefined })
  if (resposta.status === 204) return undefined as T
  return resposta.json()
}

// monta a query string ignorando campos vazios
function query(params: Record<string, string | number | null | undefined>) {
  const lista = Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  const texto = new URLSearchParams(lista.map(([k, v]) => [k, String(v)])).toString()
  return texto ? `?${texto}` : ''
}

export function urlImagem(produto: { id?: number; produto_id?: number; tem_imagem: boolean; imagem_url: string }) {
  if (produto.tem_imagem) return `/api/imagens/${produto.id ?? produto.produto_id}`
  return produto.imagem_url || ''
}

// filiais
export const buscarFiliais = () => get<Filial[]>('/api/filiais')

// produtos
export const buscarProdutos = (filtros: { busca?: string; categoria?: string; status?: string; filial_id?: number | null } = {}) =>
  get<Produto[]>(`/api/produtos${query(filtros)}`)
export const buscarProduto = (id: number, filialId?: number | null) =>
  get<ProdutoDetalhe>(`/api/produtos/${id}${query({ filial_id: filialId })}`)
export const buscarCategorias = () => get<string[]>('/api/categorias')
export const criarProduto = (dados: ProdutoDados) => enviar<Produto>('POST', '/api/produtos', dados)
export const editarProduto = (id: number, dados: ProdutoDados) => enviar<Produto>('PUT', `/api/produtos/${id}`, dados)
export const excluirProduto = (id: number) => enviar<void>('DELETE', `/api/produtos/${id}`)
export const enviarImagem = (id: number, imagem: string) => enviar<void>('PUT', `/api/produtos/${id}/imagem`, { imagem })
export const consultarCodigoBarras = (ean: string) => get<ResultadoCodigoBarras>(`/api/codigo-barras/${ean}`)

// movimentações
export const buscarMovimentacoes = (filtros: { tipo?: string; produto_id?: number; filial_id?: number | null } = {}) =>
  get<Movimentacao[]>(`/api/movimentacoes${query(filtros)}`)
export const registrarMovimentacao = (dados: NovaMovimentacao) =>
  enviar<Movimentacao[]>('POST', '/api/movimentacoes', dados)
export const buscarValidades = (filialId?: number | null, dias = 60) =>
  get<LoteValidade[]>(`/api/validades${query({ filial_id: filialId, dias })}`)

// fornecedores
export const buscarFornecedores = () => get<Fornecedor[]>('/api/fornecedores')
export const criarFornecedor = (dados: FornecedorDados) => enviar<Fornecedor>('POST', '/api/fornecedores', dados)
export const editarFornecedor = (id: number, dados: FornecedorDados) =>
  enviar<Fornecedor>('PUT', `/api/fornecedores/${id}`, dados)
export const excluirFornecedor = (id: number) => enviar<void>('DELETE', `/api/fornecedores/${id}`)

// compras
export const buscarSugestao = (filialId: number) =>
  get<SugestaoFornecedor[]>(`/api/compras/sugestao${query({ filial_id: filialId })}`)
export const buscarPedidos = (filialId?: number | null) => get<Pedido[]>(`/api/pedidos${query({ filial_id: filialId })}`)
export const criarPedido = (dados: {
  fornecedor_id: number
  filial_id: number
  observacao?: string
  itens: { produto_id: number; quantidade: number; custo: number }[]
}) => enviar<Pedido>('POST', '/api/pedidos', dados)
export const receberPedido = (id: number, itens: { item_id: number; lote_codigo: string; validade: string | null }[]) =>
  enviar<Pedido>('POST', `/api/pedidos/${id}/receber`, { itens })
export const cancelarPedido = (id: number) => enviar<Pedido>('POST', `/api/pedidos/${id}/cancelar`)

// painel
export const buscarPainel = (filialId?: number | null) => get<Painel>(`/api/painel${query({ filial_id: filialId })}`)

export async function restaurarDemonstracao() {
  await requisicao('/api/workspaces/restaurar', { method: 'POST' })
}

export async function baixarCsv(filialId?: number | null) {
  const resposta = await requisicao(`/api/relatorios/estoque.csv${query({ filial_id: filialId })}`)
  const url = URL.createObjectURL(await resposta.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = 'estoque.csv'
  link.click()
  URL.revokeObjectURL(url)
}
