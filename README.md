# Controle de Estoque para Atacado

Sistema web de estoque pensado para um atacado de alimentos e bebidas: consulta de produtos por código de barras, controle de lotes e validade, entradas e saídas, fornecedores e pedidos de compra, com mais de uma filial.

Trabalhei alguns anos com logística e controle de estoque e muita coisa era feita no papel ou em planilha: conferir validade, saber o que estava acabando, decidir quanto pedir para o fornecedor. A ideia do projeto foi montar o sistema que eu gostaria de ter usado, juntando o que estou estudando de Python e React.

**Demo:** https://controle-estoque-wheat-rho.vercel.app

Cada pessoa que abre a demo ganha uma empresa de exemplo própria (o "Atacado Demo", com filiais em Palhoça e São José), já com produtos e 60 dias de histórico. Pode cadastrar, vender, receber pedido e excluir à vontade, isso não afeta os dados de outras pessoas. O botão "Restaurar dados de exemplo" volta tudo ao início.

## Funcionalidades

**Produtos**
- Consulta por EAN (código de barras), nome ou marca, com painel lateral mostrando foto, descrição, estoque por filial, lotes e últimas movimentações
- Cadastro com busca automática pelo código de barras: o sistema consulta o [Open Food Facts](https://br.openfoodfacts.org) e preenche nome, marca, peso e foto
- Leitura do código de barras pela câmera do celular (onde o navegador suporta) ou com leitor USB
- Envio de foto do produto (a imagem é reduzida no navegador antes de ir para o servidor)
- Preço de varejo e de atacado, quantidade mínima para o preço de atacado, unidades por fardo e margem

**Estoque**
- Entradas com lote e validade; saídas por venda, perda, avaria ou ajuste
- A saída usa primeiro o lote que vence antes (**FEFO**) e não deixa vender lote vencido
- Tela de validades com lotes vencidos e vencendo, e baixa de lote vencido como perda
- Quantidade em fardos ou unidades
- Filtro por filial em todas as telas

**Compras**
- Cadastro de fornecedores com prazo de entrega
- **Sugestão de compra**: calcula quanto pedir de cada produto usando a média de vendas dos últimos 30 dias, o prazo de entrega do fornecedor e o estoque mínimo, arredondando para fardo fechado e descontando o que já está a caminho
- Pedido de compra gerado a partir da sugestão; ao receber, a mercadoria entra no estoque com lote e validade

**Painel**
- Valor em estoque, vendas dos últimos 30 dias, lotes vencidos e vencendo
- Gráfico de entradas e saídas
- Risco de ruptura (quantos dias o estoque dura no ritmo atual)
- Curva ABC das vendas
- Exportação do estoque em CSV para o Excel

## Tecnologias

**Back-end:** Python, FastAPI, SQLAlchemy, PostgreSQL (Neon) e SQLite no desenvolvimento, pytest

**Front-end:** React, TypeScript, Vite, React Router, Recharts, Vitest e Testing Library

**Deploy:** Vercel (o front é estático e a API Python roda como função serverless na pasta `api/`)

## Algumas regras de negócio

- **Saldo:** soma das entradas menos as saídas, calculado por lote no banco (`SUM` com `CASE`).
- **FEFO (first expired, first out):** na venda, os lotes válidos são ordenados pela validade e a quantidade sai do primeiro até completar. Lote vencido fica parado até alguém dar baixa como perda.
- **Sugestão de compra:** `venda_média_dia × (prazo_entrega + 30) + estoque_mínimo − (saldo + a_caminho)`, arredondado para cima em fardos.
- **Curva ABC:** produtos ordenados pelo faturamento; os que somam os primeiros 80% são A, até 95% B e o resto C.

As contas ficam em [`api/estoque/analise.py`](api/estoque/analise.py) e têm testes em [`tests/test_analise.py`](tests/test_analise.py).

## Rodando localmente

Precisa de Python 3.11+ e Node 20+.

```bash
# API
python -m venv .venv
.venv\Scripts\activate          # no Linux/Mac: source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn api.index:app --reload --port 8000

# front-end (em outro terminal)
npm install
npm run dev
```

Abra http://localhost:5173. Sem a variável `DATABASE_URL` a API usa um arquivo SQLite (`estoque.db`).
A documentação da API fica em http://localhost:5173/api/docs.

## Testes

```bash
pytest          # API
npm test        # front-end
npm run lint
```

## Estrutura

```
api/
  index.py             entrada da API (usada pela Vercel)
  estoque/
    main.py            cria o app e os espaços de demonstração
    db.py              tabelas e conexão com o banco
    schemas.py         validação dos dados (Pydantic)
    estoque.py         saldo, entrada e saída por lote
    analise.py         FEFO, sugestão de compra, curva ABC...
    demo.py            gera os dados de exemplo
    rotas/             produtos, movimentações, fornecedores, compras e painel
tests/                 testes da API
src/
  pages/               telas
  components/          componentes (detalhe do produto, formulário, leitor de código...)
  api.ts               chamadas para a API
```

## Créditos

Fotos e dados dos produtos de exemplo: [Open Food Facts](https://br.openfoodfacts.org), base aberta de produtos (licença ODbL / CC BY-SA). O nome da empresa e os fornecedores da demonstração são fictícios.

## O que eu ainda quero fazer

- Login de usuários com permissões (caixa, estoque, compras)
- Transferência de mercadoria entre filiais
- Importar a nota fiscal (XML da NF-e) para dar entrada automática

---

Feito por Renan Amaral de Oliveira · [GitHub](https://github.com/OLIVERPSYCHO)
