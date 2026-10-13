# Split and Go

Aplicacao para organizar despesas compartilhadas. Este guia descreve a configuracao atual do repositorio e como executar o frontend e o backend em ambiente local.

## Tecnologias e estado atual

- **Frontend:** React 19 e Vite 8.
- **Backend:** Django 6.1 e Django REST Framework.
- **Banco de dados:** PostgreSQL, configurado por variaveis de ambiente.
- **Driver PostgreSQL:** Psycopg 3.
- **Usuario do sistema:** modelo customizado `api.User`, com UUID, nome, email unico, senha armazenada com hash e datas de criacao/atualizacao.
- **API disponivel:** `GET /api/health/`.


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
