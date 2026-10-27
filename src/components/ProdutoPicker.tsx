import { useState, type KeyboardEvent } from 'react'
import { urlImagem } from '../api'
import type { Produto } from '../types'
import ImagemProduto from './ImagemProduto'

interface Props {
  produtos: Produto[]
  selecionado: Produto | null
  onSelecionar: (produto: Produto | null) => void
}

// campo para escolher produto digitando nome ou EAN (leitor de código de barras USB também funciona,
// porque ele "digita" o código e aperta Enter)
export default function ProdutoPicker({ produtos, selecionado, onSelecionar }: Props) {
  const [texto, setTexto] = useState('')
  const [aberto, setAberto] = useState(false)

  const termo = texto.trim().toLowerCase()
  const resultados = termo
    ? produtos.filter((p) => p.ean.includes(termo) || p.nome.toLowerCase().includes(termo) || p.marca.toLowerCase().includes(termo)).slice(0, 8)
    : []

  function escolher(produto: Produto) {
    onSelecionar(produto)
    setTexto('')
    setAberto(false)
  }

  function aoApertarTecla(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const exato = produtos.find((p) => p.ean === termo)
    if (exato) escolher(exato)
    else if (resultados.length === 1) escolher(resultados[0])
  }

  if (selecionado) {
    return (
      <div className="picker-selecionado">
        <ImagemProduto src={urlImagem(selecionado)} alt={selecionado.nome} />
        <div>
          <strong>{selecionado.nome}</strong>
          <span className="texto-fraco">
            EAN {selecionado.ean || '-'} · {selecionado.marca}
          </span>
        </div>
        <button type="button" className="link-acao" onClick={() => onSelecionar(null)}>
          Trocar
        </button>
      </div>
    )
  }

  return (
    <div className="picker">
      <input
        value={texto}
        placeholder="Digite o EAN ou o nome do produto"
        onChange={(e) => {
          setTexto(e.target.value)
          setAberto(true)
        }}
        onKeyDown={aoApertarTecla}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        aria-label="Produto"
        autoFocus
      />
      {aberto && resultados.length > 0 && (
        <ul className="picker-lista">
          {resultados.map((p) => (
            <li key={p.id}>
              <button type="button" onMouseDown={() => escolher(p)}>
                <ImagemProduto src={urlImagem(p)} alt="" />
                <span>
                  {p.nome}
                  <small>
                    {p.ean} · saldo {p.saldo}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
