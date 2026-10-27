// o leitor pela câmera usa a BarcodeDetector API, que ainda não existe em todos os navegadores
export function scannerDisponivel() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices
}
