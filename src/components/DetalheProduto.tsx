import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { buscarProduto, urlImagem } from '../api'
import { useFilial } from '../FilialContext'
import { useDados } from '../hooks/useDados'
import {
  formatarData, formatarDataHora, formatarFardos, formatarMoeda, formatarValidadeProduto, margem, NOMES_MOTIVO,
} from '../utils/format'
import ImagemProduto from './ImagemProduto'
import StatusBadge, { ValidadeBadge } from './StatusBadge'

interface Props {
  produtoId: number
  onFechar: () => void
  onEditar: () => void
  onExcluir: () => void
}

export default function DetalheProduto({ produtoId, onFechar, onEditar, onExcluir }: Props) {
  const { filialId } = useFilial()
  const carregar = useCallback(() => buscarProduto(produtoId, filialId), [produtoId, filialId])
  const { dados: p, erro } = useDados(carregar)

  if (erro) return <aside className="detalhe"><p className="erro">{erro}</p></aside>
  if (!p || p.id !== produtoId) return <aside className="detalhe"><p className="texto-fraco">Carregando...</p></aside>

  return (
    <aside className="detalhe">
      <button className="botao-fechar detalhe-fechar" onClick={onFechar} aria-label="Fechar detalhes">
        ×
      </button>

      <div className="detalhe-topo">
        <ImagemProduto src={urlImagem(p)} alt={p.nome} tamanho="grande" />
        <div className="detalhe-info">
          <h2>{p.nome}</h2>
          <span className="detalhe-marca">{p.marca}</span>
          <span className="chip">{p.categoria}</span>

          <dl className="detalhe-dados">
            <div>
              <dt>EAN</dt>
              <dd>{p.ean || '-'}</dd>
            </div>
            <div>
              <dt>Estoque {filialId ? 'na filial' : 'total'}</dt>
              <dd>
                {p.saldo} unidades <small>({formatarFardos(p.saldo, p.qtd_por_fardo)})</small>
              </dd>
            </div>
            <div>
              <dt>Quantidade por fardo</dt>
              <dd>{p.qtd_por_fardo} unidades</dd>
            </div>
            <div>
              <dt>Preço de venda</dt>
              <dd>
                {formatarMoeda(p.preco_varejo)}
                <small>
                  {' '}
                  · atacado {formatarMoeda(p.preco_atacado)} a partir de {p.qtd_minima_atacado} un
                </small>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {p.descricao && (
        <section>
          <h3>Descrição do produto</h3>
          <p className="detalhe-descricao">{p.descricao}</p>
        </section>
      )}

      <section>
        <h3>Informações adicionais</h3>
        <dl className="tabela-info">
          <dt>Marca</dt>
          <dd>{p.marca || '-'}</dd>
          <dt>Categoria</dt>
          <dd>{p.categoria}</dd>
          <dt>Peso / volume</dt>
          <dd>{p.peso || '-'}</dd>
          <dt>Validade</dt>
          <dd>{formatarValidadeProduto(p.validade_dias)}</dd>
          <dt>Fornecedor</dt>
          <dd>{p.fornecedor_nome || '-'}</dd>
          <dt>Custo</dt>
          <dd>
            {formatarMoeda(p.custo)} <small>(margem varejo {margem(p.preco_varejo, p.custo).toFixed(0)}%)</small>
          </dd>
          <dt>Estoque mínimo</dt>
          <dd>{p.estoque_minimo} un</dd>
        </dl>
        <StatusBadge status={p.status} />
      </section>

      {!filialId && (
        <section>
          <h3>Estoque por filial</h3>
          <dl className="tabela-info">
            {Object.entries(p.saldo_por_filial).map(([filial, saldo]) => (
              <div key={filial} className="linha-info">
                <dt>{filial}</dt>
                <dd>{saldo} un</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section>
        <h3>Lotes em estoque</h3>
        {p.lotes.length === 0 ? (
          <p className="texto-fraco">Nenhum lote com saldo.</p>
        ) : (
          <table className="tabela-compacta">
            <thead>
              <tr>
                <th>Lote</th>
                {!filialId && <th>Filial</th>}
                <th>Validade</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {p.lotes.map((l) => (
                <tr key={l.id}>
                  <td>{l.codigo}</td>
                  {!filialId && <td>{l.filial_nome}</td>}
                  <td>
                    {formatarData(l.validade)} {l.situacao !== 'ok' && l.situacao !== 'sem_validade' && <ValidadeBadge situacao={l.situacao} />}
                  </td>
                  <td>{l.saldo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3>Últimas movimentações</h3>
        {p.movimentacoes.length === 0 ? (
          <p className="texto-fraco">Nenhuma movimentação.</p>
        ) : (
          <ul className="lista-movs">
            {p.movimentacoes.map((m) => (
              <li key={m.id}>
                <span className={m.tipo === 'entrada' ? 'qtd-entrada' : 'qtd-saida'}>
                  {m.tipo === 'entrada' ? '+' : '-'}
                  {m.quantidade}
                </span>
                <span>{NOMES_MOTIVO[m.motivo] ?? m.motivo}</span>
                <span className="texto-fraco">
                  {formatarDataHora(m.criado_em)} · {m.filial_nome}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="detalhe-acoes">
        <Link className="botao" to={`/entradas?produto=${p.id}`}>
          Entrada
        </Link>
        <Link className="botao botao-claro" to={`/saidas?produto=${p.id}`}>
          Saída
        </Link>
        <button className="botao botao-claro" onClick={onEditar}>
          Editar
        </button>
        <button className="botao botao-perigo" onClick={onExcluir}>
          Excluir
        </button>
      </div>
    </aside>
  )
}
