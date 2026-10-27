import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Movimentacoes from './pages/Movimentacoes'
import Painel from './pages/Painel'
import Produtos from './pages/Produtos'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Painel />} />
        <Route path="/produtos" element={<Produtos />} />
        <Route path="/movimentacoes" element={<Movimentacoes />} />
        <Route path="*" element={<p className="aviso">Página não encontrada.</p>} />
      </Route>
    </Routes>
  )
}
