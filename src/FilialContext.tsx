import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { buscarFiliais } from './api'
import type { Filial } from './types'

interface FilialContexto {
  filiais: Filial[]
  filialId: number | null // null = todas as filiais
  setFilialId: (id: number | null) => void
}

const Contexto = createContext<FilialContexto>({ filiais: [], filialId: null, setFilialId: () => {} })

const CHAVE = 'controle-estoque:filial'

function lerFilialSalva() {
  try {
    const valor = localStorage.getItem(CHAVE)
    return valor ? Number(valor) : null
  } catch {
    return null
  }
}

export function FilialProvider({ children }: { children: ReactNode }) {
  const [filiais, setFiliais] = useState<Filial[]>([])
  const [filialId, setFilialIdState] = useState<number | null>(lerFilialSalva)

  useEffect(() => {
    buscarFiliais()
      .then((lista) => {
        setFiliais(lista)
        // se a filial salva não existe mais (demo restaurada), volta para a primeira
        setFilialIdState((atual) => (atual && lista.some((f) => f.id === atual) ? atual : lista[0]?.id ?? null))
      })
      .catch(() => setFiliais([]))
  }, [])

  function setFilialId(id: number | null) {
    setFilialIdState(id)
    try {
      if (id) localStorage.setItem(CHAVE, String(id))
      else localStorage.removeItem(CHAVE)
    } catch {
      // ignora
    }
  }

  return <Contexto.Provider value={{ filiais, filialId, setFilialId }}>{children}</Contexto.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFilial() {
  return useContext(Contexto)
}
