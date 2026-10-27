import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ProdutoForm from './ProdutoForm'

describe('ProdutoForm', () => {
  it('envia os dados preenchidos', async () => {
    const onSalvar = vi.fn().mockResolvedValue(undefined)
    render(<ProdutoForm categorias={['EPI']} onSalvar={onSalvar} onCancelar={() => {}} />)

    await userEvent.type(screen.getByLabelText('SKU'), 'EPI-010')
    await userEvent.type(screen.getByLabelText('Nome do produto'), 'Capacete')
    await userEvent.type(screen.getByLabelText('Categoria'), 'EPI')
    await userEvent.clear(screen.getByLabelText('Estoque mínimo'))
    await userEvent.type(screen.getByLabelText('Estoque mínimo'), '5')
    await userEvent.clear(screen.getByLabelText('Custo unitário (R$)'))
    await userEvent.type(screen.getByLabelText('Custo unitário (R$)'), '45.9')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(onSalvar).toHaveBeenCalledWith({
      sku: 'EPI-010',
      nome: 'Capacete',
      categoria: 'EPI',
      unidade: 'un',
      estoque_minimo: 5,
      custo_unitario: 45.9,
    })
  })

  it('mostra o erro da API', async () => {
    const onSalvar = vi.fn().mockRejectedValue(new Error('Já existe um produto com o SKU EPI-001'))
    const produto = {
      id: 1, sku: 'EPI-001', nome: 'Luva', categoria: 'EPI', unidade: 'par',
      estoque_minimo: 10, custo_unitario: 7.8, saldo: 20, status: 'ok' as const, valor_em_estoque: 156,
    }
    render(<ProdutoForm produto={produto} categorias={[]} onSalvar={onSalvar} onCancelar={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Já existe um produto com o SKU EPI-001')).toBeInTheDocument()
  })
})
