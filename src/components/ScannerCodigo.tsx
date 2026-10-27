import { useEffect, useRef, useState } from 'react'

// BarcodeDetector ainda não está nos tipos do TypeScript
interface Detector {
  detect: (fonte: HTMLVideoElement) => Promise<{ rawValue: string }[]>
}
declare global {
  interface Window {
    BarcodeDetector?: new (opcoes: { formats: string[] }) => Detector
  }
}

interface Props {
  onLer: (codigo: string) => void
  onFechar: () => void
}

// lê código de barras pela câmera (funciona no Chrome do Android e em alguns navegadores de computador)
export default function ScannerCodigo({ onLer, onFechar }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const [erro, setErro] = useState('')
  // guarda a função numa ref para a câmera não reiniciar a cada render do formulário
  const onLerRef = useRef(onLer)
  useEffect(() => {
    onLerRef.current = onLer
  }, [onLer])

  useEffect(() => {
    let stream: MediaStream | null = null
    let parar = false

    async function iniciar() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (!video.current) return
        video.current.srcObject = stream
        await video.current.play()

        const detector = new window.BarcodeDetector!({ formats: ['ean_13', 'ean_8', 'upc_a'] })
        while (!parar) {
          const codigos = await detector.detect(video.current)
          if (codigos.length > 0) {
            onLerRef.current(codigos[0].rawValue)
            return
          }
          await new Promise((r) => setTimeout(r, 250))
        }
      } catch {
        setErro('Não foi possível acessar a câmera. Digite o código manualmente.')
      }
    }
    iniciar()

    return () => {
      parar = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div className="scanner">
      {erro ? <p className="erro">{erro}</p> : <video ref={video} muted playsInline />}
      <p className="texto-fraco">Aponte a câmera para o código de barras.</p>
      <button type="button" className="botao botao-claro" onClick={onFechar}>
        Cancelar
      </button>
    </div>
  )
}
