import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Compras from './pages/Compras'
import Fornecedores from './pages/Fornecedores'
import Inicio from './pages/Inicio'
import Movimentar from './pages/Movimentar'
import Produtos from './pages/Produtos'
import Validades from './pages/Validades'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Inicio />} />
        <Route path="/produtos" element={<Produtos />} />
        <Route path="/validades" element={<Validades />} />
        <Route path="/entradas" element={<Movimentar key="entrada" tipo="entrada" />} />
        <Route path="/saidas" element={<Movimentar key="saida" tipo="saida" />} />
        <Route path="/compras" element={<Compras />} />
        <Route path="/fornecedores" element={<Fornecedores />} />
        <Route path="*" element={<p className="texto-fraco">Página não encontrada.</p>} />
      </Route>
    </Routes>
  )
}
