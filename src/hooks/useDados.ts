import { useEffect, useState } from 'react'

// carrega dados da API e guarda o estado de carregando/erro
// a função carregar precisa ser estável (useCallback), senão recarrega a cada render
export function useDados<T>(carregar: () => Promise<T>) {
  const [dados, setDados] = useState<T | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [atualizar, setAtualizar] = useState(0)

  useEffect(() => {
    let ativo = true

    carregar()
      .then((resultado) => {
        if (ativo) {
          setDados(resultado)
          setErro('')
        }
      })
      .catch((e) => {
        if (ativo) setErro(e.message)
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })

    return () => {
      ativo = false
    }
  }, [carregar, atualizar])

  function recarregar() {
    setAtualizar((n) => n + 1)
  }

  return { dados, erro, carregando, recarregar }
}
