import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { restaurarDemonstracao } from '../api'

export default function Layout() {
  const [restaurando, setRestaurando] = useState(false)

  async function restaurar() {
    if (!confirm('Isso apaga suas alterações e volta os dados de exemplo. Continuar?')) return
    setRestaurando(true)
    try {
      await restaurarDemonstracao()
      window.location.reload()
    } catch (e) {
      alert((e as Error).message)
      setRestaurando(false)
    }
  }

  return (
    <div className="app">
      <aside className="menu">
        <div className="logo">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>Controle de Estoque</span>
        </div>

        <nav className="menu-links">
          <NavLink to="/" end>
            Painel
          </NavLink>
          <NavLink to="/produtos">Produtos</NavLink>
          <NavLink to="/movimentacoes">Movimentações</NavLink>
        </nav>

        <div className="menu-rodape">
          <p>
            <strong>Modo demonstração.</strong> Os dados são de exemplo e ficam salvos só para você.
          </p>
          <button className="botao botao-claro" onClick={restaurar} disabled={restaurando}>
            {restaurando ? 'Restaurando...' : 'Restaurar dados de exemplo'}
          </button>
          <a href="/api/docs" target="_blank" rel="noreferrer">
            Documentação da API
          </a>
          <a href="https://github.com/OLIVERPSYCHO/controle-estoque" target="_blank" rel="noreferrer">
            Código no GitHub
          </a>
        </div>
      </aside>

      <main className="conteudo">
        <Outlet />
      </main>
    </div>
  )
}
