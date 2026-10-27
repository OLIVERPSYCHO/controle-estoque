import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { baixarCsv, buscarCategorias, buscarProdutos, criarProduto, editarProduto, excluirProduto } from '../api'
import Modal from '../components/Modal'
import ProdutoForm from '../components/ProdutoForm'
import StatusBadge from '../components/StatusBadge'
import { useDados } from '../hooks/useDados'
import type { Produto, ProdutoDados } from '../types'
import { formatarMoeda } from '../utils/format'

export default function Produtos() {
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [status, setStatus] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [produtoEditando, setProdutoEditando] = useState<Produto | undefined>()

  const carregarProdutos = useCallback(() => buscarProdutos(busca, categoria, status), [busca, categoria, status])
  const produtos = useDados(carregarProdutos)
  const categorias = useDados(buscarCategorias)

  function abrirNovo() {
    setProdutoEditando(undefined)
    setModalAberto(true)
  }

  function abrirEdicao(produto: Produto) {
    setProdutoEditando(produto)
    setModalAberto(true)
  }

  async function salvar(dados: ProdutoDados) {
    if (produtoEditando) {
      await editarProduto(produtoEditando.id, dados)
    } else {
      await criarProduto(dados)
    }
    setModalAberto(false)
    produtos.recarregar()
    categorias.recarregar()
  }

  async function excluir(produto: Produto) {
    if (!confirm(`Excluir "${produto.nome}"? O histórico de movimentações dele também será apagado.`)) return
    try {
      await excluirProduto(produto.id)
      produtos.recarregar()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  async function exportar() {
    try {
      await baixarCsv()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const lista = produtos.dados ?? []

  return (
    <>
      <div className="titulo-pagina">
        <h1>Produtos</h1>
        <div className="botoes">
          <button className="botao botao-claro" onClick={exportar}>
            Exportar CSV
          </button>
          <button className="botao" onClick={abrirNovo}>
            + Novo produto
          </button>
        </div>
      </div>

      <div className="filtros">
        <input
          type="search"
          placeholder="Buscar por nome ou SKU"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar produto"
        />
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {categorias.dados?.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">Todos os status</option>
          <option value="ok">Normal</option>
          <option value="baixo">Abaixo do mínimo</option>
          <option value="zerado">Sem estoque</option>
        </select>
      </div>

      {produtos.erro && <p className="erro">{produtos.erro}</p>}

      <div className="card">
        {produtos.carregando && !produtos.dados ? (
          <p className="aviso">Carregando produtos...</p>
        ) : lista.length === 0 ? (
          <p className="aviso">Nenhum produto encontrado.</p>
        ) : (
          <div className="tabela-container">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Saldo</th>
                  <th>Mínimo</th>
                  <th>Custo</th>
                  <th>Valor em estoque</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.id}>
                    <td className="sku">{p.sku}</td>
                    <td>{p.nome}</td>
                    <td>{p.categoria}</td>
                    <td>
                      {p.saldo} {p.unidade}
                    </td>
                    <td>{p.estoque_minimo}</td>
                    <td>{formatarMoeda(p.custo_unitario)}</td>
                    <td>{formatarMoeda(p.valor_em_estoque)}</td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="acoes">
                      <Link className="link-acao" to={`/movimentacoes?produto=${p.id}`}>
                        Movimentar
                      </Link>
                      <button className="link-acao" onClick={() => abrirEdicao(p)}>
                        Editar
                      </button>
                      <button className="link-acao link-perigo" onClick={() => excluir(p)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalAberto && (
        <Modal titulo={produtoEditando ? 'Editar produto' : 'Novo produto'} onFechar={() => setModalAberto(false)}>
          <ProdutoForm
            produto={produtoEditando}
            categorias={categorias.dados ?? []}
            onSalvar={salvar}
            onCancelar={() => setModalAberto(false)}
          />
        </Modal>
      )}
    </>
  )
}
