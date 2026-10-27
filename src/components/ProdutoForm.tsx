import { useState, type FormEvent } from 'react'
import { consultarCodigoBarras, urlImagem } from '../api'
import type { Fornecedor, Produto, ProdutoDados } from '../types'
import { margem } from '../utils/format'
import { reduzirImagem } from '../utils/imagem'
import ImagemProduto from './ImagemProduto'
import { scannerDisponivel } from '../utils/scanner'
import ScannerCodigo from './ScannerCodigo'

interface Props {
  produto?: Produto
  categorias: string[]
  fornecedores: Fornecedor[]
  onSalvar: (dados: ProdutoDados, imagemNova: string | null) => Promise<void>
  onCancelar: () => void
}

export default function ProdutoForm({ produto, categorias, fornecedores, onSalvar, onCancelar }: Props) {
  const [ean, setEan] = useState(produto?.ean ?? '')
  const [nome, setNome] = useState(produto?.nome ?? '')
  const [marca, setMarca] = useState(produto?.marca ?? '')
  const [categoria, setCategoria] = useState(produto?.categoria ?? '')
  const [descricao, setDescricao] = useState(produto?.descricao ?? '')
  const [peso, setPeso] = useState(produto?.peso ?? '')
  const [qtdPorFardo, setQtdPorFardo] = useState(String(produto?.qtd_por_fardo ?? 1))
  const [validadeDias, setValidadeDias] = useState(String(produto?.validade_dias ?? 0))
  const [custo, setCusto] = useState(String(produto?.custo ?? ''))
  const [precoVarejo, setPrecoVarejo] = useState(String(produto?.preco_varejo ?? ''))
  const [precoAtacado, setPrecoAtacado] = useState(String(produto?.preco_atacado ?? ''))
  const [qtdMinimaAtacado, setQtdMinimaAtacado] = useState(String(produto?.qtd_minima_atacado ?? 1))
  const [estoqueMinimo, setEstoqueMinimo] = useState(String(produto?.estoque_minimo ?? 0))
  const [fornecedorId, setFornecedorId] = useState(produto?.fornecedor_id ? String(produto.fornecedor_id) : '')
  const [imagemUrl, setImagemUrl] = useState(produto?.imagem_url ?? '')
  const [imagemNova, setImagemNova] = useState<string | null>(null)

  const [buscandoEan, setBuscandoEan] = useState(false)
  const [avisoEan, setAvisoEan] = useState('')
  const [lendoCamera, setLendoCamera] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const previa = imagemNova ?? (produto?.tem_imagem ? urlImagem(produto) : imagemUrl)

  async function buscarPorEan(codigo: string) {
    if (!codigo) return
    setBuscandoEan(true)
    setAvisoEan('')
    try {
      const dados = await consultarCodigoBarras(codigo)
      // só preenche o que ainda está vazio, para não apagar o que a pessoa digitou
      if (!nome) setNome(dados.nome)
      if (!marca) setMarca(dados.marca)
      if (!peso) setPeso(dados.peso)
      if (dados.imagem_url && !imagemNova) setImagemUrl(dados.imagem_url)
      setAvisoEan('Dados encontrados no Open Food Facts. Confira antes de salvar.')
    } catch (e) {
      setAvisoEan((e as Error).message)
    } finally {
      setBuscandoEan(false)
    }
  }

  async function escolherFoto(arquivo: File | undefined) {
    if (!arquivo) return
    try {
      setImagemNova(await reduzirImagem(arquivo))
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      await onSalvar(
        {
          ean: ean.trim(),
          nome,
          marca,
          categoria,
          descricao,
          peso,
          qtd_por_fardo: Number(qtdPorFardo),
          validade_dias: Number(validadeDias),
          custo: Number(custo),
          preco_varejo: Number(precoVarejo),
          preco_atacado: Number(precoAtacado),
          qtd_minima_atacado: Number(qtdMinimaAtacado),
          estoque_minimo: Number(estoqueMinimo),
          fornecedor_id: fornecedorId ? Number(fornecedorId) : null,
          imagem_url: imagemUrl,
        },
        imagemNova,
      )
    } catch (err) {
      setErro((err as Error).message)
      setSalvando(false)
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form-produto-topo">
        <div className="form-foto">
          <ImagemProduto src={previa} alt={nome} tamanho="grande" />
          <label className="botao botao-claro botao-arquivo">
            Enviar foto
            <input type="file" accept="image/*" onChange={(e) => escolherFoto(e.target.files?.[0])} />
          </label>
        </div>

        <div className="form-campos">
          <label>
            Código de barras (EAN)
            <div className="campo-com-botao">
              <input
                inputMode="numeric"
                maxLength={14}
                value={ean}
                onChange={(e) => setEan(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    buscarPorEan(ean)
                  }
                }}
              />
              <button type="button" className="botao botao-claro" onClick={() => buscarPorEan(ean)} disabled={!ean || buscandoEan}>
                {buscandoEan ? 'Buscando...' : 'Buscar'}
              </button>
              {scannerDisponivel() && (
                <button type="button" className="botao botao-claro" onClick={() => setLendoCamera(true)}>
                  Câmera
                </button>
              )}
            </div>
          </label>
          {avisoEan && <p className="texto-fraco">{avisoEan}</p>}
          {lendoCamera && (
            <ScannerCodigo
              onLer={(codigo) => {
                setLendoCamera(false)
                setEan(codigo)
                buscarPorEan(codigo)
              }}
              onFechar={() => setLendoCamera(false)}
            />
          )}

          <label>
            Nome do produto
            <input required minLength={2} maxLength={150} value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>

          <div className="form-linha">
            <label>
              Marca
              <input maxLength={80} value={marca} onChange={(e) => setMarca(e.target.value)} />
            </label>
            <label>
              Categoria
              <input required list="lista-categorias" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
              <datalist id="lista-categorias">
                {categorias.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
          </div>
        </div>
      </div>

      <label>
        Descrição
        <textarea rows={3} maxLength={2000} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </label>

      <div className="form-linha">
        <label>
          Peso / volume
          <input placeholder="Ex.: 5 kg" maxLength={30} value={peso} onChange={(e) => setPeso(e.target.value)} />
        </label>
        <label>
          Unidades por fardo
          <input type="number" min={1} required value={qtdPorFardo} onChange={(e) => setQtdPorFardo(e.target.value)} />
        </label>
        <label>
          Validade (dias)
          <input type="number" min={0} value={validadeDias} onChange={(e) => setValidadeDias(e.target.value)} />
        </label>
      </div>

      <div className="form-linha">
        <label>
          Custo (R$)
          <input type="number" min={0} step={0.01} required value={custo} onChange={(e) => setCusto(e.target.value)} />
        </label>
        <label>
          Preço varejo (R$)
          <input type="number" min={0} step={0.01} required value={precoVarejo} onChange={(e) => setPrecoVarejo(e.target.value)} />
        </label>
        <label>
          Preço atacado (R$)
          <input type="number" min={0} step={0.01} required value={precoAtacado} onChange={(e) => setPrecoAtacado(e.target.value)} />
        </label>
      </div>
      {Number(custo) > 0 && Number(precoVarejo) > 0 && (
        <p className="texto-fraco">
          Margem: varejo {margem(Number(precoVarejo), Number(custo)).toFixed(1)}% · atacado{' '}
          {margem(Number(precoAtacado), Number(custo)).toFixed(1)}%
        </p>
      )}

      <div className="form-linha">
        <label>
          Qtd. mínima p/ atacado (un)
          <input type="number" min={1} required value={qtdMinimaAtacado} onChange={(e) => setQtdMinimaAtacado(e.target.value)} />
        </label>
        <label>
          Estoque mínimo (un)
          <input type="number" min={0} required value={estoqueMinimo} onChange={(e) => setEstoqueMinimo(e.target.value)} />
        </label>
        <label>
          Fornecedor
          <select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
            <option value="">Sem fornecedor</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      {erro && <p className="erro">{erro}</p>}

      <div className="form-botoes">
        <button type="button" className="botao botao-claro" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" className="botao" disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}
