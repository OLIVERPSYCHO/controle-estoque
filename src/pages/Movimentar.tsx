import { useCallback, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { buscarMovimentacoes, buscarProduto, buscarProdutos, registrarMovimentacao } from '../api'
import ProdutoPicker from '../components/ProdutoPicker'
import { ValidadeBadge } from '../components/StatusBadge'
import { useFilial } from '../FilialContext'
import { useDados } from '../hooks/useDados'
import type { Produto, TipoMovimentacao } from '../types'
import { formatarData, formatarDataHora, formatarFardos, NOMES_MOTIVO } from '../utils/format'

const MOTIVOS = {
  entrada: ['compra', 'devolucao', 'ajuste'],
  saida: ['venda', 'perda', 'avaria', 'uso_interno', 'ajuste'],
}

// a mesma tela serve para entrada e saída
export default function Movimentar({ tipo }: { tipo: TipoMovimentacao }) {
  const [params] = useSearchParams()
  const { filiais, filialId } = useFilial()

  const [produtoEscolhido, setProdutoEscolhido] = useState<Produto | null>(null)
  const [escolheuManual, setEscolheuManual] = useState(false)
  const [filial, setFilial] = useState('')
  const [motivo, setMotivo] = useState(MOTIVOS[tipo][0])
  const [porFardo, setPorFardo] = useState(true)
  const [quantidade, setQuantidade] = useState('')
  const [lote, setLote] = useState('')
  const [validade, setValidade] = useState('')
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [enviando, setEnviando] = useState(false)

  const filialEscolhida = Number(filial) || filialId || filiais[0]?.id || null

  const carregarProdutos = useCallback(() => buscarProdutos({ filial_id: filialEscolhida }), [filialEscolhida])
  const produtos = useDados(carregarProdutos)

  // se veio de outra tela com ?produto=ID, já começa com ele selecionado
  const idDaUrl = Number(params.get('produto'))
  const produtoDaUrl = !escolheuManual && idDaUrl ? produtos.dados?.find((p) => p.id === idDaUrl) ?? null : null
  const produto = produtoEscolhido ?? produtoDaUrl

  function escolherProduto(p: Produto | null) {
    setProdutoEscolhido(p)
    setEscolheuManual(true)
  }

  const carregarHistorico = useCallback(() => buscarMovimentacoes({ tipo, filial_id: filialId }), [tipo, filialId])
  const historico = useDados(carregarHistorico)

  // lotes do produto, para mostrar na saída qual vai ser usado
  const carregarDetalhe = useCallback(
    () => (produto ? buscarProduto(produto.id, filialEscolhida) : Promise.resolve(null)),
    [produto, filialEscolhida],
  )
  const detalhe = useDados(carregarDetalhe)

  const qtdPorFardo = produto?.qtd_por_fardo ?? 1
  const unidades = Number(quantidade) * (porFardo ? qtdPorFardo : 1)

  async function registrar(e: FormEvent) {
    e.preventDefault()
    if (!produto || !filialEscolhida) return
    setErro('')
    setSucesso('')
    setEnviando(true)
    try {
      const movs = await registrarMovimentacao({
        produto_id: produto.id,
        filial_id: filialEscolhida,
        tipo,
        motivo,
        quantidade: unidades,
        observacao,
        lote_codigo: lote,
        validade: validade || null,
      })
      const lotes = movs.map((m) => `${m.lote_codigo} (${m.quantidade})`).join(', ')
      setSucesso(`${tipo === 'entrada' ? 'Entrada' : 'Saída'} de ${unidades} un de ${produto.nome} registrada. Lote: ${lotes}`)
      setQuantidade('')
      setLote('')
      setValidade('')
      setObservacao('')
      produtos.recarregar()
      historico.recarregar()
      detalhe.recarregar()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const saldoAtual = produtos.dados?.find((p) => p.id === produto?.id)?.saldo ?? produto?.saldo ?? 0

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>{tipo === 'entrada' ? 'Entradas' : 'Saídas'}</h1>
          <p className="texto-fraco">
            {tipo === 'entrada'
              ? 'Recebimento de mercadoria. Informe o lote e a validade que vieram na nota ou na embalagem.'
              : 'Venda, perda ou avaria. A saída usa primeiro o lote que vence antes (FEFO). Lote vencido não sai como venda.'}
          </p>
        </div>
      </div>

      <div className="grade-movimentar">
        <section className="card">
          <form className="form" onSubmit={registrar}>
            <label>
              Produto
              <ProdutoPicker produtos={produtos.dados ?? []} selecionado={produto} onSelecionar={escolherProduto} />
            </label>

            <div className="form-linha">
              <label>
                Filial
                <select value={filialEscolhida ?? ''} onChange={(e) => setFilial(e.target.value)}>
                  {filiais.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Motivo
                <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                  {MOTIVOS[tipo].map((m) => (
                    <option key={m} value={m}>
                      {NOMES_MOTIVO[m]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-linha">
              <label>
                Quantidade
                <div className="campo-com-botao">
                  <input type="number" min={1} required value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
                  <select value={porFardo ? 'fardo' : 'un'} onChange={(e) => setPorFardo(e.target.value === 'fardo')} aria-label="Unidade">
                    <option value="fardo">fardo ({qtdPorFardo} un)</option>
                    <option value="un">unidade</option>
                  </select>
                </div>
              </label>
              {tipo === 'entrada' && (
                <>
                  <label>
                    Lote
                    <input maxLength={40} placeholder="Opcional" value={lote} onChange={(e) => setLote(e.target.value)} />
                  </label>
                  <label>
                    Validade
                    <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
                  </label>
                </>
              )}
            </div>

            <label>
              Observação
              <input maxLength={200} placeholder="Ex.: NF 12345, pedido do cliente..." value={observacao} onChange={(e) => setObservacao(e.target.value)} />
            </label>

            {produto && (
              <p className="texto-fraco">
                Saldo atual na filial: <strong>{saldoAtual} un</strong> ({formatarFardos(saldoAtual, qtdPorFardo)})
                {Number(quantidade) > 0 && <> · esta {tipo === 'entrada' ? 'entrada' : 'saída'}: {unidades} un</>}
              </p>
            )}
            {erro && <p className="erro">{erro}</p>}
            {sucesso && <p className="sucesso">{sucesso}</p>}

            <div className="form-botoes">
              <button type="submit" className="botao" disabled={enviando || !produto}>
                {enviando ? 'Registrando...' : `Registrar ${tipo === 'entrada' ? 'entrada' : 'saída'}`}
              </button>
            </div>
          </form>
        </section>

        <section className="card">
          <h2>Lotes na filial</h2>
          {!produto ? (
            <p className="texto-fraco">Escolha um produto para ver os lotes.</p>
          ) : !detalhe.dados || detalhe.dados.lotes.length === 0 ? (
            <p className="texto-fraco">Nenhum lote com saldo.</p>
          ) : (
            <table className="tabela-compacta">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Validade</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {detalhe.dados.lotes.map((l) => (
                  <tr key={l.id}>
                    <td>{l.codigo}</td>
                    <td>
                      {formatarData(l.validade)} {l.situacao !== 'ok' && <ValidadeBadge situacao={l.situacao} />}
                    </td>
                    <td>{l.saldo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Últimas {tipo === 'entrada' ? 'entradas' : 'saídas'}</h2>
        {historico.erro && <p className="erro">{historico.erro}</p>}
        <div className="tabela-container">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>EAN</th>
                <th>Produto</th>
                <th>Filial</th>
                <th>Motivo</th>
                <th>Lote</th>
                <th>Qtd.</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {historico.dados?.map((m) => (
                <tr key={m.id}>
                  <td>{formatarDataHora(m.criado_em)}</td>
                  <td className="ean">{m.produto_ean}</td>
                  <td>{m.produto_nome}</td>
                  <td>{m.filial_nome}</td>
                  <td>{NOMES_MOTIVO[m.motivo] ?? m.motivo}</td>
                  <td>{m.lote_codigo}</td>
                  <td className={tipo === 'entrada' ? 'qtd-entrada' : 'qtd-saida'}>{m.quantidade}</td>
                  <td>{m.observacao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
