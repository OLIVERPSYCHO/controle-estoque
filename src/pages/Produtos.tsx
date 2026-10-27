import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  baixarCsv, buscarCategorias, buscarFornecedores, buscarProdutos, criarProduto, editarProduto, enviarImagem,
  excluirProduto,
} from '../api'
import DetalheProduto from '../components/DetalheProduto'
import Modal from '../components/Modal'
import ProdutoForm from '../components/ProdutoForm'
import StatusBadge from '../components/StatusBadge'
import { useFilial } from '../FilialContext'
import { useDados } from '../hooks/useDados'
import type { Produto, ProdutoDados } from '../types'
import { formatarMoeda } from '../utils/format'

export default function Produtos() {
  const [params, setParams] = useSearchParams()
  const busca = params.get('busca') ?? ''
  const { filialId } = useFilial()
  const [categoria, setCategoria] = useState('')
  const [status, setStatus] = useState('')
  const [selecionadoId, setSelecionadoId] = useState<number | null>(null)
  const [versaoDetalhe, setVersaoDetalhe] = useState(0)
  const [formulario, setFormulario] = useState<{ produto?: Produto } | null>(null)

  const carregar = useCallback(
    () => buscarProdutos({ busca, categoria, status, filial_id: filialId }),
    [busca, categoria, status, filialId],
  )
  const produtos = useDados(carregar)
  const categorias = useDados(buscarCategorias)
  const fornecedores = useDados(buscarFornecedores)
  const lista = produtos.dados ?? []

  // se a busca do topo achou um produto só (ex.: leu o código de barras), já abre o detalhe
  const [buscaFechada, setBuscaFechada] = useState('')
  const abertoPelaBusca = busca && busca !== buscaFechada && lista.length === 1 ? lista[0].id : null
  const idAberto = selecionadoId ?? abertoPelaBusca

  function fecharDetalhe() {
    setSelecionadoId(null)
    setBuscaFechada(busca)
  }

  async function salvar(dados: ProdutoDados, imagemNova: string | null) {
    const salvo = formulario?.produto ? await editarProduto(formulario.produto.id, dados) : await criarProduto(dados)
    if (imagemNova) await enviarImagem(salvo.id, imagemNova)
    setFormulario(null)
    setSelecionadoId(salvo.id)
    setVersaoDetalhe((v) => v + 1)
    produtos.recarregar()
    categorias.recarregar()
  }

  async function excluir(produto: Produto) {
    if (!confirm(`Excluir "${produto.nome}"? O histórico de movimentações também será apagado.`)) return
    try {
      await excluirProduto(produto.id)
      setSelecionadoId(null)
      produtos.recarregar()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const selecionado = lista.find((p) => p.id === idAberto)

  return (
    <div className={idAberto ? 'consulta com-detalhe' : 'consulta'}>
      <div className="consulta-lista">
        <div className="titulo-pagina">
          <div>
            <h1>Consulta de Produtos</h1>
            <p className="texto-fraco">Busque por EAN, nome ou marca do produto.</p>
          </div>
          <div className="botoes">
            <button className="botao botao-claro" onClick={() => baixarCsv(filialId).catch((e) => alert(e.message))}>
              Exportar CSV
            </button>
            <button className="botao" onClick={() => setFormulario({})}>
              + Novo produto
            </button>
          </div>
        </div>

        <div className="filtros">
          {busca && (
            <span className="chip chip-filtro">
              Busca: {busca}
              <button onClick={() => setParams({})} aria-label="Limpar busca">
                ×
              </button>
            </span>
          )}
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
            <option value="ok">Disponível</option>
            <option value="baixo">Estoque baixo</option>
            <option value="zerado">Sem estoque</option>
          </select>
          <span className="texto-fraco">{lista.length} produtos</span>
        </div>

        {produtos.erro && <p className="erro">{produtos.erro}</p>}

        <div className="painel-tabela">
          {produtos.carregando && !produtos.dados ? (
            <p className="texto-fraco">Carregando produtos...</p>
          ) : lista.length === 0 ? (
            <p className="texto-fraco">Nenhum produto encontrado.</p>
          ) : (
            <table className="tabela-produtos">
              <thead>
                <tr>
                  <th>EAN</th>
                  <th>Produto</th>
                  <th>Marca</th>
                  <th>Estoque</th>
                  <th>Preço</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr
                    key={p.id}
                    className={p.id === idAberto ? 'selecionada' : ''}
                    onClick={() => setSelecionadoId(p.id)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setSelecionadoId(p.id)}
                  >
                    <td className="ean">{p.ean}</td>
                    <td>{p.nome}</td>
                    <td>{p.marca}</td>
                    <td>{p.saldo}</td>
                    <td>{formatarMoeda(p.preco_varejo)}</td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {idAberto && (
        <DetalheProduto
          key={`${idAberto}-${versaoDetalhe}`}
          produtoId={idAberto}
          onFechar={fecharDetalhe}
          onEditar={() => selecionado && setFormulario({ produto: selecionado })}
          onExcluir={() => selecionado && excluir(selecionado)}
        />
      )}

      {formulario && (
        <Modal titulo={formulario.produto ? 'Editar produto' : 'Novo produto'} onFechar={() => setFormulario(null)}>
          <ProdutoForm
            produto={formulario.produto}
            categorias={categorias.dados ?? []}
            fornecedores={fornecedores.dados ?? []}
            onSalvar={salvar}
            onCancelar={() => setFormulario(null)}
          />
        </Modal>
      )}
    </div>
  )
}
