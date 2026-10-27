import { describe, expect, it } from 'vitest'
import { formatarCobertura, formatarDia, formatarMoeda } from './format'

describe('format', () => {
  it('formata moeda em reais', () => {
    expect(formatarMoeda(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50')
  })

  it('formata o dia como dd/mm', () => {
    expect(formatarDia('2026-10-05')).toBe('05/10')
  })

  it('mostra a cobertura em dias', () => {
    expect(formatarCobertura(null)).toBe('Sem consumo')
    expect(formatarCobertura(0.4)).toBe('Menos de 1 dia')
    expect(formatarCobertura(1.8)).toBe('1 dia')
    expect(formatarCobertura(12.3)).toBe('12 dias')
  })
})
