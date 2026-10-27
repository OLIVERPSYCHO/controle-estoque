import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Produto } from '../types'
import ProdutoForm from './ProdutoForm'

const PRODUTO: Produto = {
  id: 1,
  ean: '7896036090244',
  nome: 'Óleo de Soja Liza 900ml',
  marca: 'Liza',
  categoria: 'Mercearia',
  descricao: '',
  peso: '900 ml',
  qtd_por_fardo: 20,
  validade_dias: 365,
  custo: 6.2,
  preco_varejo: 7.99,
  preco_atacado: 7.29,
  qtd_minima_atacado: 20,
  estoque_minimo: 100,
  fornecedor_id: null,
  imagem_url: '',
  tem_imagem: false,
  saldo: 300,
  status: 'ok',
  proxima_validade: null,
  fornecedor_nome: '',
}

describe('ProdutoForm', () => {
  it('envia os dados preenchidos', async () => {
    const onSalvar = vi.fn().mockResolvedValue(undefined)
    render(<ProdutoForm categorias={['Mercearia']} fornecedores={[]} onSalvar={onSalvar} onCancelar={() => {}} />)

    await userEvent.type(screen.getByLabelText('Nome do produto'), 'Arroz Branco 5kg')
    await userEvent.type(screen.getByLabelText('Categoria'), 'Mercearia')
    await userEvent.clear(screen.getByLabelText('Unidades por fardo'))
    await userEvent.type(screen.getByLabelText('Unidades por fardo'), '6')
    await userEvent.type(screen.getByLabelText('Custo (R$)'), '20')
    await userEvent.type(screen.getByLabelText('Preço varejo (R$)'), '26.9')
    await userEvent.type(screen.getByLabelText('Preço atacado (R$)'), '24.5')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(onSalvar).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: 'Arroz Branco 5kg',
        categoria: 'Mercearia',
        qtd_por_fardo: 6,
        custo: 20,
        preco_varejo: 26.9,
        preco_atacado: 24.5,
        fornecedor_id: null,
      }),
      null,
    )
  })

  it('mostra a margem', () => {
    render(<ProdutoForm produto={PRODUTO} categorias={[]} fornecedores={[]} onSalvar={vi.fn()} onCancelar={() => {}} />)
    // (7,99 - 6,20) / 7,99 = 22,4%
    expect(screen.getByText(/varejo 22.4%/)).toBeInTheDocument()
  })

  it('mostra o erro da API', async () => {
    const onSalvar = vi.fn().mockRejectedValue(new Error('Já existe um produto com o EAN 7896036090244'))
    render(<ProdutoForm produto={PRODUTO} categorias={[]} fornecedores={[]} onSalvar={onSalvar} onCancelar={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Já existe um produto com o EAN 7896036090244')).toBeInTheDocument()
  })
})
