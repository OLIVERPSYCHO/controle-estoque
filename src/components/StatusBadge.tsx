import type { SituacaoValidade, StatusEstoque } from '../types'
import { NOMES_STATUS, NOMES_VALIDADE } from '../utils/format'

export default function StatusBadge({ status }: { status: StatusEstoque }) {
  return <span className={`badge badge-${status}`}>{NOMES_STATUS[status]}</span>
}

export function ValidadeBadge({ situacao }: { situacao: SituacaoValidade }) {
  return <span className={`badge validade-${situacao}`}>{NOMES_VALIDADE[situacao]}</span>
}
