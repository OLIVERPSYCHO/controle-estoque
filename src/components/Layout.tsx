import { useEffect, useState, type FormEvent } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { restaurarDemonstracao } from '../api'
import { useFilial } from '../FilialContext'

// nome fictício da empresa da demonstração
export const NOME_EMPRESA = 'Atacado Demo'

const MENU = [
  { para: '/', texto: 'Início', icone: 'M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z' },
  { para: '/produtos', texto: 'Consulta de Produtos', icone: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4-4' },
  { para: '/validades', texto: 'Validades', icone: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z' },
  { para: '/entradas', texto: 'Entradas', icone: 'M12 4v12m0 0-4-4m4 4 4-4M4 20h16' },
  { para: '/saidas', texto: 'Saídas', icone: 'M12 16V4m0 0L8 8m4-4 4 4M4 20h16' },
  { para: '/compras', texto: 'Compras', icone: 'M3 4h2l2.5 11h11L21 8H7M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z' },
  { para: '/fornecedores', texto: 'Fornecedores', icone: 'M3 17V7h11v10M14 10h4l3 3v4h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
]

function Icone({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

export default function Layout() {
  const { filiais, filialId, setFilialId } = useFilial()
  const [busca, setBusca] = useState('')
  const [agora, setAgora] = useState(() => new Date())
  const [menuAberto, setMenuAberto] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  function pesquisar(e: FormEvent) {
    e.preventDefault()
    navigate(`/produtos?busca=${encodeURIComponent(busca.trim())}`)
    setBusca('')
  }

  async function restaurar() {
    if (!confirm('Isso apaga suas alterações e volta os dados de exemplo. Continuar?')) return
    try {
      await restaurarDemonstracao()
      window.location.reload()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <div className="app">
      <aside className={menuAberto ? 'menu menu-aberto' : 'menu'}>
        <div className="logo">
          <img src="/favicon.svg" alt="" width={38} height={38} />
          <div>
            <strong>{NOME_EMPRESA}</strong>
            <span>Sistema de Estoque</span>
          </div>
        </div>

        <nav className="menu-links" onClick={() => setMenuAberto(false)}>
          {MENU.map((item) => (
            <NavLink key={item.para} to={item.para} end={item.para === '/'}>
              <Icone d={item.icone} />
              {item.texto}
            </NavLink>
          ))}
        </nav>

        <div className="menu-rodape">
          <span className="online">Sistema online</span>
          <span>{agora.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
          <button className="link-acao" onClick={restaurar}>
            Restaurar dados de exemplo
          </button>
          <a href="/api/docs" target="_blank" rel="noreferrer">
            Documentação da API
          </a>
          <a href="https://github.com/OLIVERPSYCHO/controle-estoque" target="_blank" rel="noreferrer">
            Código no GitHub
          </a>
        </div>
      </aside>

      <div className="principal">
        <header className="topo">
          <button className="botao-menu" onClick={() => setMenuAberto(!menuAberto)} aria-label="Abrir menu">
            ☰
          </button>
          <form className="busca-topo" onSubmit={pesquisar}>
            <Icone d={MENU[1].icone} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Digite o EAN, nome do produto ou marca..."
              aria-label="Buscar produto"
            />
          </form>
          <label className="filial">
            Filial:
            <select
              value={filialId ?? ''}
              onChange={(e) => setFilialId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Todas</option>
              {filiais.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="usuario">
            <span className="avatar">D</span>
            <div>
              <strong>Demonstração</strong>
              <span>Estoque</span>
            </div>
          </div>
        </header>

        <main className="conteudo">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
