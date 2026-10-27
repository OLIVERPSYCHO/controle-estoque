import type { StatusEstoque } from '../types'
import { NOMES_STATUS } from '../utils/format'

export default function StatusBadge({ status }: { status: StatusEstoque }) {
  return <span className={`badge badge-${status}`}>{NOMES_STATUS[status]}</span>
}
