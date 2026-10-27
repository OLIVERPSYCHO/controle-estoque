import type { Movimentacao, NovaMovimentacao, Painel, Produto, ProdutoDados } from './types'

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

async function getJson<T>(url: string, opcoes?: RequestInit): Promise<T> {
  const resposta = await requisicao(url, opcoes)
  return resposta.json()
}

export function buscarPainel() {
  return getJson<Painel>('/api/painel')
}

export function buscarProdutos(busca = '', categoria = '', status = '') {
  const params = new URLSearchParams({ busca, categoria, status })
  return getJson<Produto[]>(`/api/produtos?${params}`)
}

export function buscarCategorias() {
  return getJson<string[]>('/api/categorias')
}

export function criarProduto(dados: ProdutoDados) {
  return getJson<Produto>('/api/produtos', { method: 'POST', body: JSON.stringify(dados) })
}

export function editarProduto(id: number, dados: ProdutoDados) {
  return getJson<Produto>(`/api/produtos/${id}`, { method: 'PUT', body: JSON.stringify(dados) })
}

export async function excluirProduto(id: number) {
  await requisicao(`/api/produtos/${id}`, { method: 'DELETE' })
}

export function buscarMovimentacoes(produtoId?: number) {
  const filtro = produtoId ? `?produto_id=${produtoId}` : ''
  return getJson<Movimentacao[]>(`/api/movimentacoes${filtro}`)
}

export function registrarMovimentacao(dados: NovaMovimentacao) {
  return getJson<Movimentacao>('/api/movimentacoes', { method: 'POST', body: JSON.stringify(dados) })
}

export async function restaurarDemonstracao() {
  await requisicao('/api/workspaces/restaurar', { method: 'POST' })
}

export async function baixarCsv() {
  const resposta = await requisicao('/api/relatorios/estoque.csv')
  const url = URL.createObjectURL(await resposta.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = 'estoque.csv'
  link.click()
  URL.revokeObjectURL(url)
}
