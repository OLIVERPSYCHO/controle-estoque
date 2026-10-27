// diminui a foto antes de enviar, para não guardar arquivo de vários MB no banco
export function reduzirImagem(arquivo: File, tamanhoMaximo = 600): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onerror = () => reject(new Error('Não foi possível ler a imagem'))
    leitor.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Arquivo não é uma imagem válida'))
      img.onload = () => {
        const escala = Math.min(1, tamanhoMaximo / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * escala)
        canvas.height = Math.round(img.height * escala)
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Navegador não suporta canvas'))
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/webp', 0.82))
      }
      img.src = leitor.result as string
    }
    leitor.readAsDataURL(arquivo)
  })
}
