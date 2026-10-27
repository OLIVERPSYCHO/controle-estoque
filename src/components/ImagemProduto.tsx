import { useState } from 'react'

interface Props {
  src: string
  alt: string
  tamanho?: 'pequena' | 'grande'
}

export default function ImagemProduto({ src, alt, tamanho = 'pequena' }: Props) {
  const [erro, setErro] = useState(false)

  if (!src || erro) {
    return (
      <div className={`imagem-produto imagem-${tamanho} sem-imagem`} aria-label="Produto sem foto">
        <svg viewBox="0 0 24 24" width="40%" height="40%" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 3 21 7.5v9L12 21l-9-4.5v-9z M3 7.5 12 12l9-4.5 M12 12v9" />
        </svg>
      </div>
    )
  }

  return (
    <div className={`imagem-produto imagem-${tamanho}`}>
      <img src={src} alt={alt} loading="lazy" onError={() => setErro(true)} />
    </div>
  )
}
