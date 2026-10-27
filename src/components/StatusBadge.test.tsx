import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import StatusBadge, { ValidadeBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('mostra o texto de cada status', () => {
    render(
      <>
        <StatusBadge status="ok" />
        <StatusBadge status="baixo" />
        <StatusBadge status="zerado" />
        <ValidadeBadge situacao="vencido" />
      </>,
    )
    expect(screen.getByText('Disponível')).toHaveClass('badge-ok')
    expect(screen.getByText('Estoque baixo')).toHaveClass('badge-baixo')
    expect(screen.getByText('Sem estoque')).toHaveClass('badge-zerado')
    expect(screen.getByText('Vencido')).toHaveClass('validade-vencido')
  })
})
