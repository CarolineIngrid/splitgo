# Split and Go

Aplicacao para organizar despesas compartilhadas. Este README registra como o projeto esta configurado hoje e como outros desenvolvedores podem executa-lo localmente.

## Tecnologias e estado atual

- **Frontend:** React 19 com Vite 8. Os scripts disponiveis sao `dev`, `build`, `lint` e `preview`.
- **Backend:** Django 6.1 com Django REST Framework.
- **Banco de dados:** SQLite, armazenado em `backend/db.sqlite3`. Nao e necessario instalar ou iniciar um servidor de banco para desenvolvimento.
- **API implementada:** `GET /api/health/`, disponivel localmente em `http://127.0.0.1:8000/api/health/`.
- **Autenticacao:** a tela de login/cadastro e apenas uma interface; ainda nao envia dados nem esta ligada a endpoints de autenticacao.

O PostgreSQL ainda **nao** esta configurado no projeto. A conexao atual continua usando SQLite, conforme `backend/config/settings.py`.

## Estrutura

```text
backend/
  api/                 Aplicacao Django e endpoints da API
  config/              Configuracoes e rotas do Django
  manage.py            Comandos administrativos do Django
  requirements.txt     Dependencias Python do backend
frontend/
  src/                 Aplicacao React
  package.json         Dependencias e scripts npm
```

## Pre-requisitos

- Python compativel com Django 6.1.
- Node.js e npm compativeis com a versao do Vite declarada em `frontend/package.json`.

## Preparar o backend

Execute a partir da pasta raiz do repositorio. No PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
Set-Location backend
python manage.py migrate
python manage.py runserver
```

O backend fica disponivel em `http://127.0.0.1:8000`. Para verificar a API, abra `http://127.0.0.1:8000/api/health/` ou execute:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health/
```

As migracoes criam/atualizam as tabelas no arquivo SQLite configurado. Depois de adicionar ou alterar modelos, gere e aplique migracoes:

```powershell
python manage.py makemigrations
python manage.py migrate
```

## Preparar o frontend

Em outro terminal, a partir da raiz do repositorio:

```powershell
Set-Location frontend
npm install
npm run dev
```

Use o endereco exibido pelo Vite no terminal (normalmente `http://localhost:5173`).

## Comandos uteis

Execute os comandos npm dentro de `frontend/`:

```powershell
npm run lint       # verifica o codigo com ESLint
npm run build      # gera a versao de producao em frontend/dist/
npm run preview    # serve localmente o build gerado
```

Execute os comandos Django dentro de `backend/` e com o ambiente virtual ativado:

```powershell
python manage.py check
python manage.py test
```

## Configuracao e seguranca

- As dependencias Python estao declaradas em `backend/requirements.txt`; as dependencias JavaScript e scripts estao em `frontend/package.json`.
- O banco padrao e SQLite (`backend/db.sqlite3`). Para usar outro banco, atualize a configuracao `DATABASES` em `backend/config/settings.py` e adicione o driver correspondente as dependencias; nao presuma que PostgreSQL esteja ativo.
- `DEBUG` esta ativado e `ALLOWED_HOSTS` esta vazio no estado atual. As configuracoes de desenvolvimento, incluindo a chave secreta definida no arquivo de settings, nao devem ser usadas em producao. Antes de publicar, carregue valores sensiveis do ambiente e ajuste as configuracoes de seguranca do Django.
- O frontend ainda nao esta integrado a API; a tela de autenticacao exibe uma mensagem informando que os dados nao sao enviados.
