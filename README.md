# Controle de Estoque

Sistema web para controlar o estoque de um almoxarifado: cadastro de produtos, entradas e saídas, alertas de produtos acabando e curva ABC.

Trabalhei alguns anos com logística e controle de estoque, e muita coisa era feita em planilha. A ideia do projeto foi montar o sistema que eu gostaria de ter usado, juntando o que estou estudando de Python (back-end e análise de dados) e React (front-end).

**Demo:** _link da Vercel_

Cada pessoa que abre a demo ganha um estoque de exemplo próprio, com 22 produtos e 90 dias de histórico. Pode cadastrar, movimentar e excluir à vontade, isso não afeta os dados de outras pessoas. O botão "Restaurar dados de exemplo" volta tudo ao início.

## Funcionalidades

- Cadastro, edição e exclusão de produtos (SKU, categoria, unidade, estoque mínimo e custo)
- Registro de entradas e saídas, bloqueando saída maior que o saldo
- Histórico de movimentações com filtro por produto
- Busca e filtro de produtos por categoria e status (normal, abaixo do mínimo, sem estoque)
- Painel com:
  - valor total em estoque e quantidade de itens em alerta
  - gráfico de entradas e saídas dos últimos 30 dias
  - **risco de ruptura**: calcula a média de saída por dia e em quantos dias cada produto acaba
  - **curva ABC**: classifica os produtos pelo valor que saiu do estoque nos últimos 90 dias
- Exportação do estoque em CSV (abre direto no Excel)

## Tecnologias

**Back-end:** Python, FastAPI, SQLAlchemy, PostgreSQL (Neon) e SQLite no desenvolvimento, pytest

**Front-end:** React, TypeScript, Vite, React Router, Recharts, Vitest e Testing Library

**Deploy:** Vercel (o front é estático e a API Python roda como função serverless na pasta `api/`)

## Como funciona a análise

- **Saldo:** soma das entradas menos as saídas de cada produto, calculado no banco com `SUM` e `CASE`.
- **Dias até acabar:** saldo atual dividido pela média de saídas por dia nos últimos 30 dias.
- **Curva ABC:** ordeno os produtos pelo valor consumido (quantidade que saiu × custo). Os que somam os primeiros 80% do valor são classe A, até 95% classe B, e o resto classe C. A ideia é mostrar em quais produtos vale a pena ter mais controle.

O código dessas contas está em [`api/estoque/analise.py`](api/estoque/analise.py).

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
  index.py           entrada da API (usada pela Vercel)
  estoque/
    main.py          rotas
    db.py            modelos e conexão com o banco
    schemas.py       validação dos dados (Pydantic)
    analise.py       cálculos de saldo, ruptura e curva ABC
    demo.py          gera os dados de exemplo
tests/               testes da API
src/
  pages/             Painel, Produtos e Movimentações
  components/        componentes reutilizados
  api.ts             chamadas para a API
```

## O que eu ainda quero fazer

- Login de usuário em vez do modo demonstração
- Importar produtos de uma planilha
- Previsão de compra usando o histórico (quanto pedir e quando)

---

Feito por Renan Amaral de Oliveira · [GitHub](https://github.com/OLIVERPSYCHO)
