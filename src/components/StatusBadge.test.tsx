import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import StatusBadge from './StatusBadge'

describe('StatusBadge', () => {
  it('mostra o texto de cada status', () => {
    render(
      <>
        <StatusBadge status="ok" />
        <StatusBadge status="baixo" />
        <StatusBadge status="zerado" />
      </>,
    )
    expect(screen.getByText('Normal')).toHaveClass('badge-ok')
    expect(screen.getByText('Abaixo do mínimo')).toHaveClass('badge-baixo')
    expect(screen.getByText('Sem estoque')).toHaveClass('badge-zerado')
  })
})
