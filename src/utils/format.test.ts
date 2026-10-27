import { describe, expect, it } from 'vitest'
import { formatarCobertura, formatarData, formatarFardos, formatarMoeda, formatarValidadeProduto, margem } from './format'

describe('format', () => {
  it('formata moeda em reais', () => {
    expect(formatarMoeda(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50')
  })

  it('formata data sem mudar o dia por causa do fuso', () => {
    expect(formatarData('2026-10-05')).toBe('05/10/2026')
    expect(formatarData(null)).toBe('-')
  })

  it('mostra a quantidade em fardos', () => {
    expect(formatarFardos(125, 12)).toBe('10 fardos + 5 un')
    expect(formatarFardos(12, 12)).toBe('1 fardo')
    expect(formatarFardos(7, 1)).toBe('7 un')
  })

  it('mostra a validade do produto', () => {
    expect(formatarValidadeProduto(0)).toBe('Não perecível')
    expect(formatarValidadeProduto(365)).toBe('1 ano')
    expect(formatarValidadeProduto(180)).toBe('6 meses')
    expect(formatarValidadeProduto(45)).toBe('45 dias')
  })

  it('mostra a cobertura em dias', () => {
    expect(formatarCobertura(null)).toBe('Sem vendas')
    expect(formatarCobertura(0.4)).toBe('Menos de 1 dia')
    expect(formatarCobertura(12.3)).toBe('12 dias')
  })

  it('calcula a margem sobre o preço', () => {
    expect(margem(10, 7)).toBeCloseTo(30)
    expect(margem(0, 7)).toBe(0)
  })
})
