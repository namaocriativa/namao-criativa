# Coolify IaC — Namão

Provisiona via [API do Coolify](https://coolify.io/docs/api-reference/api/authorization) em [coolify.fungalia.com.br](https://coolify.fungalia.com.br/):

| Recurso | Tipo | Conteúdo |
|---------|------|----------|
| `namao-evolution` | Coolify Service (compose) | `evoapicloud/evolution-api:latest` + Postgres + Redis |
| `namao-api` | Coolify Application (Docker image) | `@namao/platform` — API unificada |
| `namao-website` | Cloudflare Pages | `@namao/website` — site público |

**PostgreSQL:** `DATABASE_URL` aponta para um Postgres Coolify ou gerenciado. Invite-requests, chat e leads usam o mesmo banco.

```text
cloud/
  compose/          # evolution.yml → base64 em docker_compose_raw
  config/           # stack.example.json (copie para stack.json)
  lib/              # cliente HTTP Coolify/Cloudflare + state
  stacks/           # evolution, runtime, website-pages
  scripts/          # bootstrap | plan | apply | deploy | website
```

## Pré-requisitos

1. Token Coolify: **Keys & Tokens → API tokens** com abilities `read`, `write`, `deploy`
2. Node 22+ e `npm install` na raiz do monorepo
3. Postgres acessível pela VPS (`DATABASE_URL` no `cloud/.env`)
4. Imagem da API publicada (CD em `.github/workflows/cd-runtime.yml`, ou push local abaixo) **antes** do primeiro `apply`

## Setup rápido

```bash
cp cloud/.env.example cloud/.env
# edite COOLIFY_API_TOKEN, RUNTIME_IMAGE_NAME, GEMINI_API_KEY, JWT_SECRET, DATABASE_URL

cp cloud/config/stack.example.json cloud/config/stack.json
# opcional: ajuste nomes / domínios

npm run cloud:bootstrap   # resolve server + cria projeto "namao"
npm run cloud:plan        # dry-run
npm run cloud:apply       # cria/atualiza Evolution + API + grava cloud/state.json
npm run cloud:deploy      # GET /api/v1/deploy?uuid=...
# force rebuild:
npm run cloud:deploy -- --force
```

`cloud/.env` e `cloud/state.json` estão no `.gitignore`.

O loader lê **primeiro** o `.env` da raiz do monorepo e depois `cloud/.env` (override).

## PostgreSQL

Crie um banco PostgreSQL no Coolify (ou use um gerenciado) e defina no `cloud/.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/namao
```

SQLite (`file:./dev.db`) **não** funciona a partir de um container na VPS.

## CD — GitHub Actions + GHCR

O Coolify **não** faz build do monorepo — ele puxa a imagem `ghcr.io/namaocriativa/namao-api`.

Em push/merge em `main`, [`.github/workflows/cd-runtime.yml`](../.github/workflows/cd-runtime.yml):

1. Detecta se a API mudou (`services/platform/**`, `packages/landing-kit/**`, `Dockerfile`, lockfile)
2. Se sim: build (`Dockerfile` target `production`) e push `:latest` + `:sha-<commit>`
3. Dispara `GET /api/v1/deploy?uuid=...&force=true` no Coolify

`workflow_dispatch` força build + deploy mesmo sem mudanças nesses paths. Mudanças em `apps/`, `cloud/` ou `leads/` **não** disparam a API.

A Action **não** roda `cloud:apply` / `cloud:deploy` (isso redeployaria Evolution e depende de `state.json` gitignored). O app `namao-api` precisa existir antes (`npm run cloud:apply`).

### Secrets e variables (repositório GitHub)

`Settings → Secrets and variables → Actions`:

| Nome | Tipo | Valor |
|------|------|--------|
| `COOLIFY_BASE_URL` | **Variable** | `https://coolify.fungalia.com.br` |
| `COOLIFY_API_TOKEN` | Secret | Token Coolify com abilities `read` + `deploy` |
| `COOLIFY_RUNTIME_UUID` | Secret | UUID da application `namao-api` (UI do Coolify, ou `runtime_application_uuid` em `cloud/state.json`) |

O `GITHUB_TOKEN` da Action basta para **push** no GHCR (`packages: write`). Ele **não** serve para o Coolify puxar a imagem.

### Visibilidade do pacote GHCR

Depois do primeiro push, em [github.com/namaocriativa?tab=packages](https://github.com/namaocriativa?tab=packages):

- **Público:** Coolify puxa sem login.
- **Privado (padrão do GHCR):** no Coolify, cadastre o registry `ghcr.io` (Server → Destinations / Docker Registry) com um PAT do usuário `namaocriativa` com `read:packages`.

No repositório: **Settings → Actions → General** — Actions habilitadas e *Workflow permissions* com permissão de criar packages via `GITHUB_TOKEN` (senão o primeiro push falha).

No `cloud/.env`, aponte o Coolify para a mesma imagem e rode `apply` uma vez:

```env
RUNTIME_IMAGE_NAME=ghcr.io/namaocriativa/namao-api
RUNTIME_IMAGE_TAG=latest
```

### Push local (opcional)

Só necessário se o CD ainda não rodou e você precisa da imagem para o primeiro `apply`:

```bash
export IMAGE=ghcr.io/namaocriativa/namao-api
export TAG=latest

docker build \
  -f Dockerfile \
  --target production \
  -t "$IMAGE:$TAG" \
  .

echo $GITHUB_TOKEN | docker login ghcr.io -u "<github-username>" --password-stdin
docker push "$IMAGE:$TAG"
```

## CD — Cloudflare Pages (`@namao/website`)

Site estático Vite em [`apps/website`](../apps/website). O projeto Pages **não** entra no `cloud:apply` (Coolify); IaC separado:

```bash
# em cloud/.env: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
npm run cloud:website:plan
npm run cloud:website
```

Isso cria (ou atualiza) o projeto `namao-website`, grava o `*.pages.dev` em `state.json` e, se `WEBSITE_DOMAIN` estiver setado, anexa apex + `www`.

Em push/merge em `main`, [`.github/workflows/cd-website.yml`](../.github/workflows/cd-website.yml):

1. Detecta mudanças em `apps/website/**` (e nos scripts de `_redirects`)
2. Gera o proxy same-origin (`public/_redirects`, gitignored)
3. `npm run build -w @namao/website`
4. `wrangler pages deploy` → produção (`branch=main`)

`workflow_dispatch` força o deploy. O `wrangler.toml` em `apps/website/` é a config versionada do projeto.

### Secrets e variables (repositório GitHub)

`Settings → Secrets and variables → Actions`:

| Nome | Tipo | Valor |
|------|------|--------|
| `CLOUDFLARE_API_TOKEN` | Secret | Token com **Account → Cloudflare Pages → Edit** (template *Edit Cloudflare Pages*) |
| `CLOUDFLARE_ACCOUNT_ID` | **Variable** | Account ID no dashboard (barra lateral direita) |
| `WEBSITE_API_ORIGIN` | Variable | Origem pública da API, ex. `https://api.namaocriativa.com.br` |

Sem `WEBSITE_API_ORIGIN` o site publica, mas login/cadastro/convites não têm para onde proxiar.

### DNS

1. Rode `npm run cloud:website` com `WEBSITE_DOMAIN=namaocriativa.com.br`
2. CNAME `namaocriativa.com.br` e `www` → `<projeto>.pages.dev` (flattening no Cloudflare se a zona for da conta)
3. `NAMAO_PUBLIC_URL=https://namaocriativa.com.br` no runtime (CORS)

### Deploy local (opcional)

```bash
npm run website:redirects -w @namao/cloud
npm run build -w @namao/website
npx wrangler pages deploy apps/website/dist --project-name=namao-website
```

### Variáveis da API (aplicadas pelo `apply`)

| Variável | Obrigatória | Notas |
|----------|-------------|-------|
| `PORT` | sim | `3000` |
| `NODE_ENV` | sim | `production` |
| `JWT_SECRET` | sim | Assina login/register |
| `GEMINI_API_KEY` | sim | Google AI Studio (pipeline + chat) |
| `DATABASE_URL` | sim | PostgreSQL |
| `REDIS_URL` | recomendada | rate limit + cache de discovery/GA4 |
| `NAMAO_PUBLIC_URL` | não | CORS extra |
| `GA4_PROPERTY_ID` | não | dashboard de estatísticas do cliente |
| `GA4_SERVICE_ACCOUNT_JSON` | não | service account com Viewer na propriedade GA4 |

Health check Coolify: `GET /health` na porta `3000`.

Defina no `cloud/.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/namao
```

## Evolution API

Compose: [`compose/evolution.yml`](compose/evolution.yml).

Após o `apply`, configure o **platform** local/futuro:

```env
EVOLUTION_API_URL=https://<url-pública-ou-proxy-coolify>
EVOLUTION_API_KEY=<mesmo AUTHENTICATION_API_KEY / cloud state>
EVOLUTION_INSTANCE=namao
```

Criar a instância WhatsApp (fora do apply):

```bash
curl -X POST "$EVOLUTION_API_URL/instance/create" \
  -H "apikey: $EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"namao","integration":"WHATSAPP-BAILEYS"}'
```

Depois escaneie o QR no manager da Evolution.

## Domínios (`namaocriativa.com.br`)

Sem DNS ainda, o apply **omite** `domains` / `urls` públicos.

Quando o domínio existir, em `cloud/config/stack.json` ou `.env`:

```env
RUNTIME_DOMAIN=https://api.namaocriativa.com.br
EVOLUTION_DOMAIN=https://evolution.namaocriativa.com.br
EVOLUTION_SERVER_URL=https://evolution.namaocriativa.com.br
NAMAO_PUBLIC_URL=https://namaocriativa.com.br
WEBSITE_DOMAIN=namaocriativa.com.br
```

```bash
npm run cloud:apply
npm run cloud:website
npm run cloud:deploy -- --force
```

No platform:

```env
PUBLIC_CHAT_API_ORIGIN=https://api.namaocriativa.com.br
```

## Fluxo operacional

| Comando | Efeito |
|---------|--------|
| `npm run cloud:bootstrap` | Lista servers; cria projeto `namao` + resolve environment |
| `npm run cloud:plan` | Dry-run (não grava state) |
| `npm run cloud:apply` | Idempotente create/update + `state.json` |
| `npm run cloud:deploy` | Dispara deploy dos UUIDs no state |
| `npm run cloud:website:plan` | Dry-run do projeto Cloudflare Pages |
| `npm run cloud:website` | Cria/atualiza Pages `namao-website` + domínio opcional |

Ordem do apply: Evolution → API (`namao-api`). Postgres via `DATABASE_URL`.

## Troubleshooting

| Sintoma | Ação |
|---------|------|
| `COOLIFY_API_TOKEN is required` | Preencha `cloud/.env` |
| `Missing server_uuid/project_uuid` | Rode `cloud:bootstrap` |
| `DATABASE_URL is required` | Configure PostgreSQL no `.env` da raiz ou `cloud/.env` |
| invite-requests falha | Postgres inacessível / migrate não rodou |
| 401 Coolify | Token inválido ou sem ability |
| API pull falha | Imagem não publicada / registry privado sem login GHCR no Coolify |
| Action não faz deploy | Path filter (API inalterada) ou secrets `COOLIFY_*` / variable `COOLIFY_BASE_URL` faltando |
| Action website não faz deploy | Path filter (`apps/website` inalterado) ou `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` faltando |
| Pages 403 no wrangler | Token sem ability *Cloudflare Pages Edit*, ou Account ID de outra conta |
| Convite / login 404 no site | `WEBSITE_API_ORIGIN` não gerou `_redirects` |
| Evolution ignora envs | Confira envs no Coolify UI; `AUTHENTICATION_API_KEY` e `DATABASE_CONNECTION_URI` |
| Domain conflict 409 | Remova domínio de outro recurso ou use `force_domain_override` na UI |

## Referências

- Coolify Authorization: https://coolify.io/docs/api-reference/api/authorization
- Create Docker Image app: https://coolify.io/docs/api-reference/api/applications/create-docker-image
- Create Service: https://coolify.io/docs/api-reference/api/services/create-service
- Deploy by UUID: https://coolify.io/docs/api-reference/api/deployments/deploy-by-tag-or-uuid
- GHCR: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
- Cloudflare Pages (direct upload): https://developers.cloudflare.com/pages/get-started/direct-upload/
- Cloudflare Pages API: https://developers.cloudflare.com/api/resources/pages/subresources/projects/methods/create/
- Evolution env vars: https://evolutionapi-evolution-api-90.mintlify.app/deployment/environment-variables
