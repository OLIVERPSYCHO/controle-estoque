import { useCallback, useState } from 'react'
import { buscarValidades, registrarMovimentacao, urlImagem } from '../api'
import ImagemProduto from '../components/ImagemProduto'
import { ValidadeBadge } from '../components/StatusBadge'
import { useFilial } from '../FilialContext'
import { useDados } from '../hooks/useDados'
import type { LoteValidade } from '../types'
import { formatarData, formatarMoeda } from '../utils/format'

export default function Validades() {
  const { filialId } = useFilial()
  const [dias, setDias] = useState(60)
  const carregar = useCallback(() => buscarValidades(filialId, dias), [filialId, dias])
  const { dados, erro, carregando, recarregar } = useDados(carregar)

  const lista = dados ?? []
  const vencidos = lista.filter((l) => l.situacao === 'vencido')
  const vencendo = lista.filter((l) => l.situacao !== 'vencido')

  async function darBaixa(lote: LoteValidade) {
    const ok = confirm(`Dar baixa de ${lote.saldo} un de "${lote.produto_nome}" (lote ${lote.lote_codigo}) como perda?`)
    if (!ok) return
    try {
      await registrarMovimentacao({
        produto_id: lote.produto_id,
        filial_id: lote.filial_id,
        tipo: 'saida',
        motivo: 'perda',
        quantidade: lote.saldo,
        observacao: `Lote vencido em ${formatarData(lote.validade)}`,
        lote_id: lote.lote_id,
      })
      recarregar()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  function tabela(itens: LoteValidade[], mostrarBaixa: boolean) {
    return (
      <div className="tabela-container">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Produto</th>
              <th>Lote</th>
              <th>Filial</th>
              <th>Validade</th>
              <th>Saldo</th>
              <th>Valor (custo)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((l) => (
              <tr key={l.lote_id}>
                <td className="celula-imagem">
                  <ImagemProduto src={urlImagem(l)} alt="" />
                </td>
                <td>
                  {l.produto_nome}
                  <small className="ean bloco">{l.produto_ean}</small>
                </td>
                <td>{l.lote_codigo}</td>
                <td>{l.filial_nome}</td>
                <td>
                  {formatarData(l.validade)}{' '}
                  <small className="texto-fraco">
                    {l.dias_para_vencer < 0 ? `há ${-l.dias_para_vencer} dias` : l.dias_para_vencer === 0 ? 'hoje' : `em ${l.dias_para_vencer} dias`}
                  </small>
                </td>
                <td>{l.saldo}</td>
                <td>{formatarMoeda(l.valor)}</td>
                <td>
                  {mostrarBaixa ? (
                    <button className="botao botao-perigo botao-pequeno" onClick={() => darBaixa(l)}>
                      Dar baixa
                    </button>
                  ) : (
                    <ValidadeBadge situacao={l.situacao} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>Controle de Validades</h1>
          <p className="texto-fraco">Lotes com saldo que já venceram ou estão perto de vencer.</p>
        </div>
        <label className="filtro-inline">
          Mostrar vencendo em até
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            <option value={15}>15 dias</option>
            <option value={30}>30 dias</option>
            <option value={60}>60 dias</option>
            <option value={90}>90 dias</option>
          </select>
        </label>
      </div>

      {erro && <p className="erro">{erro}</p>}
      {carregando && !dados && <p className="texto-fraco">Carregando...</p>}

      <section className="card">
        <h2>Vencidos ({vencidos.length})</h2>
        <p className="texto-fraco">
          Não podem ser vendidos. Valor parado: {formatarMoeda(vencidos.reduce((s, l) => s + l.valor, 0))}
        </p>
        {vencidos.length === 0 ? <p className="texto-fraco">Nenhum lote vencido.</p> : tabela(vencidos, true)}
      </section>

      <section className="card">
        <h2>Vencendo ({vencendo.length})</h2>
        <p className="texto-fraco">Dica: priorize esses lotes em promoções ou na venda para clientes de atacado.</p>
        {vencendo.length === 0 ? <p className="texto-fraco">Nenhum lote vencendo no período.</p> : tabela(vencendo, false)}
      </section>
    </>
  )
}
