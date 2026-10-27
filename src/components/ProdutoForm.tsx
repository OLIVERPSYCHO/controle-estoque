import { useState, type FormEvent } from 'react'
import type { Produto, ProdutoDados } from '../types'

interface Props {
  produto?: Produto
  categorias: string[]
  onSalvar: (dados: ProdutoDados) => Promise<void>
  onCancelar: () => void
}

export default function ProdutoForm({ produto, categorias, onSalvar, onCancelar }: Props) {
  const [sku, setSku] = useState(produto?.sku ?? '')
  const [nome, setNome] = useState(produto?.nome ?? '')
  const [categoria, setCategoria] = useState(produto?.categoria ?? '')
  const [unidade, setUnidade] = useState(produto?.unidade ?? 'un')
  const [estoqueMinimo, setEstoqueMinimo] = useState(String(produto?.estoque_minimo ?? 0))
  const [custo, setCusto] = useState(String(produto?.custo_unitario ?? 0))
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      await onSalvar({
        sku,
        nome,
        categoria,
        unidade,
        estoque_minimo: Number(estoqueMinimo),
        custo_unitario: Number(custo),
      })
    } catch (err) {
      setErro((err as Error).message)
      setSalvando(false)
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form-linha">
        <label>
          SKU
          <input required maxLength={40} value={sku} onChange={(e) => setSku(e.target.value)} />
        </label>
        <label>
          Unidade
          <input required maxLength={10} value={unidade} onChange={(e) => setUnidade(e.target.value)} />
        </label>
      </div>

      <label>
        Nome do produto
        <input required minLength={2} maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} />
      </label>

      <label>
        Categoria
        <input
          required
          list="lista-categorias"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
        />
        <datalist id="lista-categorias">
          {categorias.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>

      <div className="form-linha">
        <label>
          Estoque mínimo
          <input
            type="number"
            min={0}
            required
            value={estoqueMinimo}
            onChange={(e) => setEstoqueMinimo(e.target.value)}
          />
        </label>
        <label>
          Custo unitário (R$)
          <input
            type="number"
            min={0}
            step={0.01}
            required
            value={custo}
            onChange={(e) => setCusto(e.target.value)}
          />
        </label>
      </div>

      {erro && <p className="erro">{erro}</p>}

      <div className="form-botoes">
        <button type="button" className="botao botao-claro" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" className="botao" disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}
