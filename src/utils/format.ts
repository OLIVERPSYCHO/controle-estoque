import type { StatusEstoque } from '../types'

export function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatarNumero(valor: number) {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

export function formatarDataHora(data: string) {
  return new Date(data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

// "2026-10-26" -> "26/10"
export function formatarDia(data: string) {
  const [, mes, dia] = data.split('-')
  return `${dia}/${mes}`
}

export function formatarCobertura(dias: number | null) {
  if (dias === null) return 'Sem consumo'
  if (dias < 1) return 'Menos de 1 dia'
  const inteiro = Math.floor(dias)
  return inteiro === 1 ? '1 dia' : `${inteiro} dias`
}

export const NOMES_STATUS: Record<StatusEstoque, string> = {
  ok: 'Normal',
  baixo: 'Abaixo do mínimo',
  zerado: 'Sem estoque',
}
