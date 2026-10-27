import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { buscarPainel } from '../api'
import KpiCard from '../components/KpiCard'
import StatusBadge from '../components/StatusBadge'
import { useDados } from '../hooks/useDados'
import { formatarCobertura, formatarDia, formatarMoeda, formatarNumero } from '../utils/format'

const DESCRICAO_ABC = {
  A: 'Poucos itens que concentram a maior parte do valor. Controle de perto.',
  B: 'Itens intermediários.',
  C: 'Muitos itens de baixo valor consumido.',
}

export default function Painel() {
  const { dados, erro, carregando } = useDados(buscarPainel)

  if (carregando && !dados) return <p className="aviso">Carregando painel...</p>
  if (erro) return <p className="erro">{erro}</p>
  if (!dados) return null

  const { indicadores, serie, alertas, resumo_abc, curva_abc } = dados
  const valorTotalAbc = resumo_abc.reduce((soma, r) => soma + r.valor, 0)
  const grafico = serie.map((d) => ({ ...d, dia: formatarDia(d.dia) }))

  return (
    <>
      <h1>Painel</h1>

      <section className="kpis">
        <KpiCard titulo="Produtos cadastrados" valor={String(indicadores.total_produtos)} />
        <KpiCard titulo="Valor em estoque" valor={formatarMoeda(indicadores.valor_em_estoque)} />
        <KpiCard
          titulo="Abaixo do mínimo"
          valor={String(indicadores.itens_abaixo_minimo)}
          detalhe="precisam de reposição"
          cor={indicadores.itens_abaixo_minimo > 0 ? 'amarelo' : undefined}
        />
        <KpiCard
          titulo="Sem estoque"
          valor={String(indicadores.itens_zerados)}
          detalhe="saldo zerado"
          cor={indicadores.itens_zerados > 0 ? 'vermelho' : undefined}
        />
      </section>

      <section className="card">
        <h2>Entradas e saídas nos últimos 30 dias</h2>
        <p className="subtitulo">
          {formatarNumero(indicadores.entradas_30_dias)} unidades entraram e {formatarNumero(indicadores.saidas_30_dias)}{' '}
          saíram no período.
        </p>
        <div className="grafico">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={grafico}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="dia" fontSize={12} />
              <YAxis fontSize={12} width={40} />
              <Tooltip />
              <Legend />
              <Bar dataKey="entradas" name="Entradas" fill="#2f855a" />
              <Bar dataKey="saidas" name="Saídas" fill="#c05621" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card">
        <h2>Risco de ruptura</h2>
        <p className="subtitulo">
          Produtos abaixo do mínimo ou que acabam em menos de 15 dias, considerando a média de saídas dos últimos 30 dias.
        </p>
        {alertas.length === 0 ? (
          <p className="aviso">Nenhum produto em risco.</p>
        ) : (
          <div className="tabela-container">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Saldo</th>
                  <th>Mínimo</th>
                  <th>Saída média/dia</th>
                  <th>Acaba em</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {alertas.map((a) => (
                  <tr key={a.produto_id}>
                    <td>
                      <span className="sku">{a.sku}</span> {a.nome}
                    </td>
                    <td>{a.saldo}</td>
                    <td>{a.estoque_minimo}</td>
                    <td>{formatarNumero(a.consumo_medio_diario)}</td>
                    <td>{formatarCobertura(a.dias_de_cobertura)}</td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td>
                      <Link className="link-acao" to={`/movimentacoes?produto=${a.produto_id}&tipo=entrada`}>
                        Repor
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Curva ABC (últimos 90 dias)</h2>
        <p className="subtitulo">Classificação dos produtos pelo valor que saiu do estoque (quantidade × custo).</p>
        <div className="abc">
          {resumo_abc.map((r) => (
            <div key={r.classe} className={`abc-item abc-${r.classe}`}>
              <strong>Classe {r.classe}</strong>
              <span>
                {r.itens} {r.itens === 1 ? 'item' : 'itens'} ·{' '}
                {valorTotalAbc > 0 ? Math.round((r.valor / valorTotalAbc) * 100) : 0}% do valor
              </span>
              <small>{DESCRICAO_ABC[r.classe]}</small>
            </div>
          ))}
        </div>
        <div className="tabela-container">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Valor consumido</th>
                <th>Classe</th>
              </tr>
            </thead>
            <tbody>
              {curva_abc
                .filter((item) => item.classe === 'A')
                .map((item) => (
                  <tr key={item.produto_id}>
                    <td>
                      <span className="sku">{item.sku}</span> {item.nome}
                    </td>
                    <td>{formatarMoeda(item.valor_consumido)}</td>
                    <td>
                      <span className="badge badge-abc">{item.classe}</span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
