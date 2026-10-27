import { useCallback, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { buscarMovimentacoes, buscarProdutos, registrarMovimentacao } from '../api'
import { useDados } from '../hooks/useDados'
import type { TipoMovimentacao } from '../types'
import { formatarDataHora } from '../utils/format'

const buscarTodosProdutos = () => buscarProdutos()

export default function Movimentacoes() {
  const [params] = useSearchParams()
  const [produtoId, setProdutoId] = useState(params.get('produto') ?? '')
  const [tipo, setTipo] = useState<TipoMovimentacao>(params.get('tipo') === 'entrada' ? 'entrada' : 'saida')
  const [quantidade, setQuantidade] = useState('')
  const [observacao, setObservacao] = useState('')
  const [filtroProduto, setFiltroProduto] = useState(params.get('produto') ?? '')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [enviando, setEnviando] = useState(false)

  const carregarHistorico = useCallback(() => buscarMovimentacoes(Number(filtroProduto) || undefined), [filtroProduto])
  const produtos = useDados(buscarTodosProdutos)
  const historico = useDados(carregarHistorico)

  const produtoSelecionado = produtos.dados?.find((p) => p.id === Number(produtoId))

  async function registrar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setSucesso('')
    setEnviando(true)
    try {
      const mov = await registrarMovimentacao({
        produto_id: Number(produtoId),
        tipo,
        quantidade: Number(quantidade),
        observacao,
      })
      setSucesso(`${tipo === 'entrada' ? 'Entrada' : 'Saída'} de ${mov.quantidade} registrada para ${mov.produto_nome}.`)
      setQuantidade('')
      setObservacao('')
      produtos.recarregar()
      historico.recarregar()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <h1>Movimentações</h1>

      <section className="card">
        <h2>Registrar movimentação</h2>
        <form className="form form-movimentacao" onSubmit={registrar}>
          <label>
            Produto
            <select required value={produtoId} onChange={(e) => setProdutoId(e.target.value)}>
              <option value="">Selecione...</option>
              {produtos.dados?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} - {p.nome}
                </option>
              ))}
            </select>
          </label>

          <div className="tipo">
            <button
              type="button"
              className={tipo === 'entrada' ? 'tipo-ativo tipo-entrada' : ''}
              onClick={() => setTipo('entrada')}
            >
              Entrada
            </button>
            <button
              type="button"
              className={tipo === 'saida' ? 'tipo-ativo tipo-saida' : ''}
              onClick={() => setTipo('saida')}
            >
              Saída
            </button>
          </div>

          <div className="form-linha">
            <label>
              Quantidade
              <input
                type="number"
                min={1}
                required
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
              />
            </label>
            <label>
              Observação
              <input
                maxLength={200}
                placeholder="Ex.: nota fiscal 1234"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </label>
          </div>

          {produtoSelecionado && (
            <p className="aviso">
              Saldo atual: {produtoSelecionado.saldo} {produtoSelecionado.unidade} (mínimo{' '}
              {produtoSelecionado.estoque_minimo})
            </p>
          )}
          {erro && <p className="erro">{erro}</p>}
          {sucesso && <p className="sucesso">{sucesso}</p>}

          <div className="form-botoes">
            <button type="submit" className="botao" disabled={enviando}>
              {enviando ? 'Registrando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="titulo-pagina">
          <h2>Histórico</h2>
          <select value={filtroProduto} onChange={(e) => setFiltroProduto(e.target.value)} aria-label="Filtrar por produto">
            <option value="">Todos os produtos</option>
            {produtos.dados?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} - {p.nome}
              </option>
            ))}
          </select>
        </div>

        {historico.erro && <p className="erro">{historico.erro}</p>}
        {historico.carregando && !historico.dados ? (
          <p className="aviso">Carregando histórico...</p>
        ) : historico.dados?.length === 0 ? (
          <p className="aviso">Nenhuma movimentação.</p>
        ) : (
          <div className="tabela-container">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Produto</th>
                  <th>Tipo</th>
                  <th>Quantidade</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {historico.dados?.map((m) => (
                  <tr key={m.id}>
                    <td>{formatarDataHora(m.criado_em)}</td>
                    <td>
                      <span className="sku">{m.produto_sku}</span> {m.produto_nome}
                    </td>
                    <td>
                      <span className={`badge badge-${m.tipo}`}>{m.tipo === 'entrada' ? 'Entrada' : 'Saída'}</span>
                    </td>
                    <td>{m.tipo === 'entrada' ? `+${m.quantidade}` : `-${m.quantidade}`}</td>
                    <td>{m.observacao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="aviso">Mostrando as últimas 100 movimentações.</p>
      </section>
    </>
  )
}
