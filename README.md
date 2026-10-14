# Split and Go

Aplicacao para organizar despesas compartilhadas. Este guia descreve a configuracao atual do repositorio e como executar o frontend e o backend em ambiente local.

## Tecnologias e estado atual

- **Frontend:** React 19 e Vite 8.
- **Backend:** Django 6.1 e Django REST Framework.
- **Banco de dados:** PostgreSQL, configurado por variaveis de ambiente.
- **Driver PostgreSQL:** Psycopg 3.
- **Usuario do sistema:** modelo customizado `api.User`, com UUID, nome, email unico, senha armazenada com hash e datas de criacao/atualizacao.
- **API disponivel:** verificacao, cadastro, autenticacao por sessao, grupos compartilhados e despesas com rateio em `/api/`.

A tela de cadastro envia nome, email e senha para o backend, que valida os dados e cria o usuario com senha em hash. O login cria uma sessao Django e redireciona ao painel; logout encerra a sessao. Grupos e despesas sao persistidos, e os participantes e parcelas sao validados no servidor. O Vite encaminha requisicoes `/api` para `http://127.0.0.1:8000`.

## Estrutura

```text
backend/
  api/                 Modelos, admin, endpoints e migracoes do Django
  config/              Settings e rotas do projeto Django
  manage.py            Comandos administrativos
  requirements.txt     Dependencias Python
  .env                 Configuracao local do banco (nao versionada)
frontend/
  src/                 Aplicacao React
  package.json         Dependencias e scripts npm
  vite.config.js       Proxy local de /api para o backend
```

## Pre-requisitos

- Python compativel com as versoes declaradas em `backend/requirements.txt`.
- Node.js e npm compativeis com a versao do Vite declarada em `frontend/package.json`.
- PostgreSQL em execucao, com um banco e um usuario para desenvolvimento.

## Configurar o PostgreSQL

Crie um banco e um usuario para desenvolvimento. Por exemplo, no `psql` com uma conta autorizada:

```sql
CREATE ROLE splitgo_user WITH LOGIN PASSWORD 'defina-uma-senha-local';
CREATE DATABASE splitgo OWNER splitgo_user;
```

Crie `backend/.env` com as credenciais locais (o arquivo e ignorado pelo Git):

```dotenv
DB_NAME=splitgo
DB_USER=splitgo_user
DB_PASSWORD=defina-uma-senha-local
DB_HOST=127.0.0.1
DB_PORT=5432
```

`DB_NAME`, `DB_USER` e `DB_PASSWORD` sao obrigatorias. `DB_HOST` e `DB_PORT` sao opcionais e usam `127.0.0.1` e `5432` por padrao. Nao versione credenciais reais.

## Executar o backend

No PowerShell, a partir da raiz do repositorio:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
Set-Location backend
python manage.py migrate
python manage.py runserver
```

O backend fica disponivel em `http://127.0.0.1:8000`. O endpoint de verificacao e `http://127.0.0.1:8000/api/health/`.

O cadastro da interface usa `POST /api/auth/register/` com JSON no formato:

```json
{
  "name": "Nome da pessoa",
  "email": "pessoa@exemplo.com",
  "password": "uma-senha-segura"
}
```

Em caso de sucesso, a API retorna `201 Created` com UUID, nome, email e data de criacao; a senha nunca e retornada. Dados invalidos, senha que nao atende aos validadores do Django e email ja cadastrado retornam `400 Bad Request` com os erros de validacao.

O metodo `GET /api/auth/register/` lista UUID, nome, email e data de criacao dos usuarios e exige uma sessao Django autenticada como staff. A senha nao e incluida na resposta. O cadastro via `POST` permanece publico. O login usa `POST /api/auth/login/`; a sessao pode ser consultada em `GET /api/auth/session/` e encerrada com `POST /api/auth/logout/`.

As requisicoes POST buscam o token CSRF em `GET /api/auth/csrf/` antes de enviar dados. No desenvolvimento local, `http://localhost:5173` e `http://127.0.0.1:5173` sao origens confiaveis; para outros ambientes, configure `CSRF_TRUSTED_ORIGINS`.

### Grupos compartilhados

As rotas de grupos usam a sessao autenticada do Django:

- `GET /api/groups/` lista somente os grupos dos quais o usuario atual participa.
- `POST /api/groups/` cria um grupo e associa o usuario autenticado como administrador. O corpo JSON exige `name` e `currency`, por exemplo:

  ```json
  {
    "name": "Viagem de ferias",
    "currency": "BRL"
  }
  ```

- `GET /api/groups/currencies/` lista as moedas aceitas para novos grupos: real brasileiro (`BRL`) e dolar americano (`USD`). A API tambem rejeita qualquer outro codigo.

A resposta de grupo inclui `id` (UUID), `name`, `currency`, `role` (`admin` ou `member`) e `created_at`. A criacao do grupo e da participacao administrativa do criador ocorre em uma unica transacao. Criar um grupo nao cria despesas.

#### Despesas compartilhadas

As despesas exigem uma sessao autenticada e que o usuario atual participe do grupo:

- `GET /api/groups/<group_id>/expenses/` lista as despesas e as parcelas do grupo.
- `POST /api/groups/<group_id>/expenses/` registra uma despesa e todas as parcelas em uma unica transacao.

O corpo exige `description`, `amount`, `paid_by` (UUID de integrante do grupo), `split_type` (`equal`, `amount` ou `percentage`) e `participants`, uma lista de objetos com `user_id`. Para rateios `amount` e `percentage`, cada participante tambem informa `value`. Exemplo de rateio por valores:

```json
{
  "description": "Jantar",
  "amount": "120.00",
  "paid_by": "UUID_DO_PAGADOR",
  "split_type": "amount",
  "participants": [
    {"user_id": "UUID_DA_PESSOA_1", "value": "70.00"},
    {"user_id": "UUID_DA_PESSOA_2", "value": "50.00"}
  ]
}
```

Os participantes do rateio e quem pagou devem ser integrantes do grupo. Valores informados precisam ser positivos; as parcelas por valor devem somar o total da despesa e os percentuais devem somar 100%. Em rateio igualitario, eventuais centavos restantes sao distribuidos entre os primeiros participantes da lista. O retorno inclui o pagador, os valores calculados e, quando informado, o percentual de cada participante.

Para criar uma conta administrativa local para o Django Admin, abra outro terminal, ative o mesmo ambiente virtual, entre em `backend/` e execute:

```powershell
python manage.py createsuperuser
```

O comando solicitara email, nome e senha. O admin fica em `http://127.0.0.1:8000/admin/`.

Ao alterar ou adicionar modelos, crie e aplique as migracoes:

```powershell
python manage.py makemigrations
python manage.py migrate
```

## Executar o frontend

Em outro terminal, a partir da raiz do repositorio:

```powershell
Set-Location frontend
npm install
npm run dev
```


## Scripts do frontend

Execute-os dentro da pasta `frontend/`:

```powershell
npm run dev       # servidor local com atualizacao durante o desenvolvimento
npm run lint      # verifica o codigo com ESLint
npm run build     # gera a versao de producao em frontend/dist/
npm run preview   # serve localmente o build gerado
```
