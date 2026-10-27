import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { buscarPainel } from '../api'
import KpiCard from '../components/KpiCard'
import StatusBadge from '../components/StatusBadge'
import { useFilial } from '../FilialContext'
import { useDados } from '../hooks/useDados'
import { formatarCobertura, formatarDia, formatarMoeda, formatarNumero } from '../utils/format'

export default function Inicio() {
  const { filialId, filiais } = useFilial()
  const carregar = useCallback(() => buscarPainel(filialId), [filialId])
  const { dados, erro, carregando } = useDados(carregar)

  if (carregando && !dados) return <p className="texto-fraco">Carregando painel... (no primeiro acesso a demonstração é criada, pode levar alguns segundos)</p>
  if (erro) return <p className="erro">{erro}</p>
  if (!dados) return null

  const { indicadores: ind, serie, ruptura, resumo_abc, mais_vendidos } = dados
  const grafico = serie.map((d) => ({ ...d, dia: formatarDia(d.dia) }))
  const nomeFilial = filiais.find((f) => f.id === filialId)?.nome ?? 'Todas as filiais'

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>Início</h1>
          <p className="texto-fraco">{nomeFilial}</p>
        </div>
      </div>

      <section className="kpis">
        <KpiCard titulo="Valor em estoque (custo)" valor={formatarMoeda(ind.valor_em_estoque)} detalhe={`${ind.total_produtos} produtos`} />
        <KpiCard titulo="Vendas nos últimos 30 dias" valor={formatarMoeda(ind.faturamento_30_dias)} detalhe="preço de varejo" />
        <KpiCard
          titulo="Estoque baixo ou zerado"
          valor={String(ind.abaixo_minimo)}
          detalhe="produtos abaixo do mínimo"
          cor={ind.abaixo_minimo ? 'amarelo' : undefined}
        />
        <KpiCard
          titulo="Lotes vencidos"
          valor={String(ind.lotes_vencidos)}
          detalhe={`${formatarMoeda(ind.valor_vencido)} parados`}
          cor={ind.lotes_vencidos ? 'vermelho' : undefined}
        />
        <KpiCard
          titulo="Vencendo em 30 dias"
          valor={String(ind.lotes_vencendo)}
          detalhe={formatarMoeda(ind.valor_vencendo)}
          cor={ind.lotes_vencendo ? 'amarelo' : undefined}
        />
        <KpiCard titulo="Pedidos de compra em aberto" valor={String(ind.pedidos_abertos)} detalhe="aguardando entrega" />
      </section>

      <div className="grade-inicio">
        <section className="card">
          <h2>Entradas e saídas (30 dias)</h2>
          <div className="grafico">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafico}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e2a44" />
                <XAxis dataKey="dia" fontSize={12} stroke="#8a97b1" />
                <YAxis fontSize={12} width={44} stroke="#8a97b1" />
                <Tooltip contentStyle={{ background: '#111a2e', border: '1px solid #1e2a44' }} cursor={{ fill: '#1e2a44' }} />
                <Legend />
                <Bar dataKey="entradas" name="Entradas (un)" fill="#22c55e" />
                <Bar dataKey="saidas" name="Saídas (un)" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card">
          <h2>Curva ABC de vendas</h2>
          <p className="texto-fraco">Produtos que somam 80% do faturamento são classe A.</p>
          <div className="abc">
            {resumo_abc.map((r) => (
              <div key={r.classe} className={`abc-item abc-${r.classe}`}>
                <strong>Classe {r.classe}</strong>
                <span>
                  {r.itens} {r.itens === 1 ? 'produto' : 'produtos'}
                </span>
                <span className="texto-fraco">{formatarNumero(r.percentual)}% das vendas</span>
              </div>
            ))}
          </div>
          <h3>Mais vendidos</h3>
          <ol className="mais-vendidos">
            {mais_vendidos.map((m) => (
              <li key={m.produto_id}>
                <span>{m.nome}</span>
                <span className="texto-fraco">
                  {m.quantidade} un · {formatarMoeda(m.faturamento)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="card">
        <div className="titulo-pagina">
          <h2>Risco de ruptura</h2>
          <Link to="/compras" className="botao botao-claro">
            Ver sugestão de compra
          </Link>
        </div>
        <p className="texto-fraco">Produtos abaixo do mínimo ou que acabam em menos de 10 dias no ritmo atual de vendas.</p>
        {ruptura.length === 0 ? (
          <p className="texto-fraco">Nenhum produto em risco.</p>
        ) : (
          <div className="tabela-container">
            <table>
              <thead>
                <tr>
                  <th>EAN</th>
                  <th>Produto</th>
                  <th>Estoque</th>
                  <th>Mínimo</th>
                  <th>Venda/dia</th>
                  <th>Acaba em</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ruptura.map((r) => (
                  <tr key={r.produto_id}>
                    <td className="ean">{r.ean}</td>
                    <td>
                      <Link className="link-acao" to={`/produtos?busca=${r.ean}`}>
                        {r.nome}
                      </Link>
                    </td>
                    <td>{r.saldo}</td>
                    <td>{r.estoque_minimo}</td>
                    <td>{formatarNumero(r.consumo_diario)}</td>
                    <td>{formatarCobertura(r.dias_de_cobertura)}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
