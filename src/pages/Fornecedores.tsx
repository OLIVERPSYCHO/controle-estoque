import { useState, type FormEvent } from 'react'
import { buscarFornecedores, criarFornecedor, editarFornecedor, excluirFornecedor } from '../api'
import Modal from '../components/Modal'
import { useDados } from '../hooks/useDados'
import type { Fornecedor } from '../types'

function FornecedorForm({ fornecedor, onSalvo, onCancelar }: { fornecedor?: Fornecedor; onSalvo: () => void; onCancelar: () => void }) {
  const [nome, setNome] = useState(fornecedor?.nome ?? '')
  const [cnpj, setCnpj] = useState(fornecedor?.cnpj ?? '')
  const [telefone, setTelefone] = useState(fornecedor?.telefone ?? '')
  const [email, setEmail] = useState(fornecedor?.email ?? '')
  const [cidade, setCidade] = useState(fornecedor?.cidade ?? '')
  const [prazo, setPrazo] = useState(String(fornecedor?.prazo_entrega_dias ?? 7))
  const [erro, setErro] = useState('')

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const dados = { nome, cnpj, telefone, email, cidade, prazo_entrega_dias: Number(prazo) }
    try {
      if (fornecedor) await editarFornecedor(fornecedor.id, dados)
      else await criarFornecedor(dados)
      onSalvo()
    } catch (err) {
      setErro((err as Error).message)
    }
  }

  return (
    <form className="form" onSubmit={salvar}>
      <label>
        Razão social / nome
        <input required minLength={2} value={nome} onChange={(e) => setNome(e.target.value)} />
      </label>
      <div className="form-linha">
        <label>
          CNPJ
          <input value={cnpj} maxLength={20} onChange={(e) => setCnpj(e.target.value)} />
        </label>
        <label>
          Telefone
          <input value={telefone} maxLength={20} onChange={(e) => setTelefone(e.target.value)} />
        </label>
      </div>
      <div className="form-linha">
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Cidade
          <input value={cidade} onChange={(e) => setCidade(e.target.value)} />
        </label>
        <label>
          Prazo de entrega (dias)
          <input type="number" min={0} max={120} required value={prazo} onChange={(e) => setPrazo(e.target.value)} />
        </label>
      </div>
      {erro && <p className="erro">{erro}</p>}
      <div className="form-botoes">
        <button type="button" className="botao botao-claro" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" className="botao">
          Salvar
        </button>
      </div>
    </form>
  )
}

export default function Fornecedores() {
  const { dados, erro, recarregar } = useDados(buscarFornecedores)
  const [formulario, setFormulario] = useState<{ fornecedor?: Fornecedor } | null>(null)

  async function excluir(f: Fornecedor) {
    if (!confirm(`Excluir o fornecedor "${f.nome}"?`)) return
    try {
      await excluirFornecedor(f.id)
      recarregar()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>Fornecedores</h1>
          <p className="texto-fraco">O prazo de entrega é usado no cálculo da sugestão de compra.</p>
        </div>
        <button className="botao" onClick={() => setFormulario({})}>
          + Novo fornecedor
        </button>
      </div>

      {erro && <p className="erro">{erro}</p>}

      <section className="card">
        <div className="tabela-container">
          <table>
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th>Cidade</th>
                <th>Contato</th>
                <th>Prazo</th>
                <th>Produtos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dados?.map((f) => (
                <tr key={f.id}>
                  <td>
                    {f.nome}
                    {f.cnpj && <small className="texto-fraco bloco">CNPJ {f.cnpj}</small>}
                  </td>
                  <td>{f.cidade}</td>
                  <td>
                    {f.telefone}
                    {f.email && <small className="texto-fraco bloco">{f.email}</small>}
                  </td>
                  <td>{f.prazo_entrega_dias} dias</td>
                  <td>{f.total_produtos}</td>
                  <td className="acoes">
                    <button className="link-acao" onClick={() => setFormulario({ fornecedor: f })}>
                      Editar
                    </button>
                    <button className="link-acao link-perigo" onClick={() => excluir(f)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {formulario && (
        <Modal titulo={formulario.fornecedor ? 'Editar fornecedor' : 'Novo fornecedor'} onFechar={() => setFormulario(null)}>
          <FornecedorForm
            fornecedor={formulario.fornecedor}
            onCancelar={() => setFormulario(null)}
            onSalvo={() => {
              setFormulario(null)
              recarregar()
            }}
          />
        </Modal>
      )}
    </>
  )
}
