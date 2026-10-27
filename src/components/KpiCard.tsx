interface Props {
  titulo: string
  valor: string
  detalhe?: string
  cor?: 'amarelo' | 'vermelho'
}

export default function KpiCard({ titulo, valor, detalhe, cor }: Props) {
  return (
    <div className={cor ? `kpi kpi-${cor}` : 'kpi'}>
      <span className="kpi-titulo">{titulo}</span>
      <strong className="kpi-valor">{valor}</strong>
      {detalhe && <span className="kpi-detalhe">{detalhe}</span>}
    </div>
  )
}
