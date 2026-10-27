import type { SituacaoValidade, StatusEstoque } from '../types'

export function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatarNumero(valor: number) {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

export function formatarDataHora(data: string) {
  return new Date(data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

// "2026-10-26" -> "26/10/2026" (sem usar Date para não ter problema de fuso)
export function formatarData(data: string | null) {
  if (!data) return '-'
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

// "2026-10-26" -> "26/10"
export function formatarDia(data: string) {
  const [, mes, dia] = data.split('-')
  return `${dia}/${mes}`
}

export function formatarCobertura(dias: number | null) {
  if (dias === null) return 'Sem vendas'
  if (dias < 1) return 'Menos de 1 dia'
  const inteiro = Math.floor(dias)
  return inteiro === 1 ? '1 dia' : `${inteiro} dias`
}

// 125 unidades em fardo de 12 -> "10 fardos + 5 un"
export function formatarFardos(unidades: number, porFardo: number) {
  if (porFardo <= 1) return `${unidades} un`
  const fardos = Math.floor(unidades / porFardo)
  const resto = unidades % porFardo
  const textoFardos = `${fardos} ${fardos === 1 ? 'fardo' : 'fardos'}`
  return resto ? `${textoFardos} + ${resto} un` : textoFardos
}

export function formatarValidadeProduto(dias: number) {
  if (!dias) return 'Não perecível'
  if (dias % 365 === 0) return `${dias / 365} ${dias === 365 ? 'ano' : 'anos'}`
  if (dias % 30 === 0) return `${dias / 30} ${dias === 30 ? 'mês' : 'meses'}`
  return `${dias} dias`
}

export function margem(preco: number, custo: number) {
  if (!preco) return 0
  return ((preco - custo) / preco) * 100
}

export const NOMES_STATUS: Record<StatusEstoque, string> = {
  ok: 'Disponível',
  baixo: 'Estoque baixo',
  zerado: 'Sem estoque',
}

export const NOMES_VALIDADE: Record<SituacaoValidade, string> = {
  ok: 'No prazo',
  vencendo: 'Vencendo',
  vencido: 'Vencido',
  sem_validade: 'Sem validade',
}

export const NOMES_MOTIVO: Record<string, string> = {
  compra: 'Compra',
  devolucao: 'Devolução',
  ajuste: 'Ajuste de inventário',
  venda: 'Venda',
  perda: 'Perda / vencido',
  avaria: 'Avaria',
  uso_interno: 'Uso interno',
}
