import { useCallback, useState } from 'react'
import { buscarPedidos, buscarSugestao, cancelarPedido, criarPedido, receberPedido } from '../api'
import Modal from '../components/Modal'
import { useFilial } from '../FilialContext'
import { useDados } from '../hooks/useDados'
import type { Pedido, SugestaoFornecedor } from '../types'
import { formatarCobertura, formatarDataHora, formatarMoeda } from '../utils/format'

function dataDaqui(dias: number) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

function CardSugestao({ grupo, filialId, onPedidoCriado }: { grupo: SugestaoFornecedor; filialId: number; onPedidoCriado: () => void }) {
  // quantidade em fardos, editável
  const [fardos, setFardos] = useState<Record<number, string>>(() =>
    Object.fromEntries(grupo.itens.map((i) => [i.produto_id, String(i.quantidade / i.qtd_por_fardo)])),
  )
  const [enviando, setEnviando] = useState(false)

  const itens = grupo.itens
    .map((i) => ({ ...i, unidades: (Number(fardos[i.produto_id]) || 0) * i.qtd_por_fardo }))
    .filter((i) => i.unidades > 0)
  const total = itens.reduce((s, i) => s + i.unidades * i.custo, 0)

  async function gerarPedido() {
    setEnviando(true)
    try {
      await criarPedido({
        fornecedor_id: grupo.fornecedor_id,
        filial_id: filialId,
        observacao: 'Gerado pela sugestão de compra',
        itens: itens.map((i) => ({ produto_id: i.produto_id, quantidade: i.unidades, custo: i.custo })),
      })
      onPedidoCriado()
    } catch (e) {
      alert((e as Error).message)
      setEnviando(false)
    }
  }

  return (
    <section className="card">
      <div className="titulo-pagina">
        <div>
          <h2>{grupo.fornecedor_nome}</h2>
          <p className="texto-fraco">Entrega em {grupo.prazo_entrega_dias} dias</p>
        </div>
        <div className="botoes">
          <strong>{formatarMoeda(total)}</strong>
          <button className="botao" onClick={gerarPedido} disabled={enviando || itens.length === 0}>
            {enviando ? 'Gerando...' : 'Gerar pedido'}
          </button>
        </div>
      </div>
      <div className="tabela-container">
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Estoque</th>
              <th>Venda/dia</th>
              <th>Acaba em</th>
              <th>Comprar (fardos)</th>
              <th>Custo</th>
            </tr>
          </thead>
          <tbody>
            {grupo.itens.map((i) => (
              <tr key={i.produto_id}>
                <td>
                  {i.produto_nome}
                  <small className="ean bloco">{i.produto_ean}</small>
                </td>
                <td>
                  {i.saldo}
                  {i.a_caminho > 0 && <small className="texto-fraco bloco">+{i.a_caminho} a caminho</small>}
                </td>
                <td>{i.consumo_diario}</td>
                <td>{formatarCobertura(i.dias_de_cobertura)}</td>
                <td>
                  <input
                    className="input-pequeno"
                    type="number"
                    min={0}
                    value={fardos[i.produto_id]}
                    onChange={(e) => setFardos({ ...fardos, [i.produto_id]: e.target.value })}
                    aria-label={`Fardos de ${i.produto_nome}`}
                  />
                  <small className="texto-fraco"> x {i.qtd_por_fardo} un</small>
                </td>
                <td>{formatarMoeda(i.custo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ReceberPedido({ pedido, onRecebido, onCancelar }: { pedido: Pedido; onRecebido: () => void; onCancelar: () => void }) {
  const [lotes, setLotes] = useState<Record<number, string>>({})
  const [validades, setValidades] = useState<Record<number, string>>(() =>
    Object.fromEntries(pedido.itens.map((i) => [i.id, i.validade_dias ? dataDaqui(i.validade_dias) : ''])),
  )
  const [erro, setErro] = useState('')

  async function confirmar() {
    try {
      await receberPedido(
        pedido.id,
        pedido.itens.map((i) => ({ item_id: i.id, lote_codigo: lotes[i.id] ?? '', validade: validades[i.id] || null })),
      )
      onRecebido()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  return (
    <div className="form">
      <p className="texto-fraco">
        Confira a mercadoria e informe o lote e a validade de cada item. A validade já vem preenchida com a validade padrão do
        produto.
      </p>
      <table className="tabela-compacta">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Qtd.</th>
            <th>Lote</th>
            <th>Validade</th>
          </tr>
        </thead>
        <tbody>
          {pedido.itens.map((i) => (
            <tr key={i.id}>
              <td>{i.produto_nome}</td>
              <td>{i.quantidade}</td>
              <td>
                <input className="input-pequeno" placeholder={`P${pedido.id}`} value={lotes[i.id] ?? ''} onChange={(e) => setLotes({ ...lotes, [i.id]: e.target.value })} aria-label="Lote" />
              </td>
              <td>
                <input type="date" value={validades[i.id]} onChange={(e) => setValidades({ ...validades, [i.id]: e.target.value })} aria-label="Validade" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {erro && <p className="erro">{erro}</p>}
      <div className="form-botoes">
        <button className="botao botao-claro" onClick={onCancelar}>
          Voltar
        </button>
        <button className="botao" onClick={confirmar}>
          Confirmar recebimento
        </button>
      </div>
    </div>
  )
}

const NOMES_STATUS_PEDIDO = { aberto: 'Aguardando entrega', recebido: 'Recebido', cancelado: 'Cancelado' }

export default function Compras() {
  const { filialId, filiais } = useFilial()
  const [aberto, setAberto] = useState<number | null>(null)
  const [recebendo, setRecebendo] = useState<Pedido | null>(null)
  const [versao, setVersao] = useState(0)

  const carregarSugestao = useCallback(
    () => (filialId ? buscarSugestao(filialId) : Promise.resolve([] as SugestaoFornecedor[])),
    [filialId],
  )
  const sugestao = useDados(carregarSugestao)
  const carregarPedidos = useCallback(() => buscarPedidos(filialId), [filialId])
  const pedidos = useDados(carregarPedidos)

  function atualizarTudo() {
    sugestao.recarregar()
    pedidos.recarregar()
    setVersao((v) => v + 1)
  }

  async function cancelar(p: Pedido) {
    if (!confirm(`Cancelar o pedido #${p.id}?`)) return
    try {
      await cancelarPedido(p.id)
      atualizarTudo()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const nomeFilial = filiais.find((f) => f.id === filialId)?.nome

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>Compras</h1>
          <p className="texto-fraco">
            A sugestão usa a média de vendas dos últimos 30 dias e o prazo de entrega do fornecedor para o estoque durar mais 30
            dias sem ficar abaixo do mínimo. Já desconta o que está a caminho.
          </p>
        </div>
      </div>

      <h2 className="subtitulo-secao">Sugestão de compra {nomeFilial && `· ${nomeFilial}`}</h2>
      {!filialId ? (
        <p className="aviso-card">Escolha uma filial no topo da página para ver a sugestão de compra.</p>
      ) : sugestao.carregando && !sugestao.dados ? (
        <p className="texto-fraco">Calculando...</p>
      ) : sugestao.dados?.length === 0 ? (
        <p className="aviso-card">Nenhum produto precisa de compra agora.</p>
      ) : (
        sugestao.dados?.map((g) => (
          <CardSugestao key={`${g.fornecedor_id}-${versao}`} grupo={g} filialId={filialId} onPedidoCriado={atualizarTudo} />
        ))
      )}

      <h2 className="subtitulo-secao">Pedidos de compra</h2>
      <section className="card">
        {pedidos.erro && <p className="erro">{pedidos.erro}</p>}
        {pedidos.dados?.length === 0 && <p className="texto-fraco">Nenhum pedido.</p>}
        <ul className="lista-pedidos">
          {pedidos.dados?.slice(0, 30).map((p) => (
            <li key={p.id}>
              <button className="pedido-linha" onClick={() => setAberto(aberto === p.id ? null : p.id)}>
                <strong>#{p.id}</strong>
                <span>{p.fornecedor_nome}</span>
                <span className="texto-fraco">{p.filial_nome}</span>
                <span className="texto-fraco">{formatarDataHora(p.criado_em)}</span>
                <span className={`badge pedido-${p.status}`}>{NOMES_STATUS_PEDIDO[p.status]}</span>
                <strong>{formatarMoeda(p.total)}</strong>
              </button>
              {aberto === p.id && (
                <div className="pedido-detalhe">
                  <table className="tabela-compacta">
                    <thead>
                      <tr>
                        <th>Produto</th>
                        <th>Quantidade</th>
                        <th>Custo</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.itens.map((i) => (
                        <tr key={i.id}>
                          <td>{i.produto_nome}</td>
                          <td>
                            {i.quantidade} un ({i.quantidade / i.qtd_por_fardo} fardos)
                          </td>
                          <td>{formatarMoeda(i.custo)}</td>
                          <td>{formatarMoeda(i.custo * i.quantidade)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {p.recebido_em && <p className="texto-fraco">Recebido em {formatarDataHora(p.recebido_em)}</p>}
                  {p.status === 'aberto' && (
                    <div className="form-botoes">
                      <button className="botao botao-claro" onClick={() => cancelar(p)}>
                        Cancelar pedido
                      </button>
                      <button className="botao" onClick={() => setRecebendo(p)}>
                        Receber mercadoria
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {recebendo && (
        <Modal titulo={`Receber pedido #${recebendo.id}`} onFechar={() => setRecebendo(null)}>
          <ReceberPedido
            pedido={recebendo}
            onCancelar={() => setRecebendo(null)}
            onRecebido={() => {
              setRecebendo(null)
              atualizarTudo()
            }}
          />
        </Modal>
      )}
    </>
  )
}
