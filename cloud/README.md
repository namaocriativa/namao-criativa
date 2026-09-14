# Coolify IaC — Namão

Provisiona via [API do Coolify](https://coolify.io/docs/api-reference/api/authorization) em [coolify.fungalia.com.br](https://coolify.fungalia.com.br/):

| Recurso | Tipo | Conteúdo |
|---------|------|----------|
| `namao-postgres` | Coolify Database (PostgreSQL) | `postgres:16-alpine` — API (`public`) + Evolution (`evolution_api`) |
| `namao-redis` | Coolify Database (Redis) | `redis:7-alpine` — API db0 + Evolution db1 |
| `namao-evolution` | Coolify Application (Docker image) | `evoapicloud/evolution-api:v2.3.7` |
| `namao-api` | Coolify Application (Docker image) | `@namao/platform` — API unificada |
| `namao-website` | Cloudflare Pages | `@namao/website` — site público |
| `namao-studio` | Cloudflare Pages | `@namao/studio` — painel interno (JWT) |

**PostgreSQL:** o `apply` cria `namao-postgres` no Coolify (mesmo destination da API) e injeta o Internal URL em `DATABASE_URL`. A Evolution usa o **mesmo** Postgres com `?schema=evolution_api`. Para um Postgres gerenciado, defina `DATABASE_URL` no `cloud/.env` e o recurso Coolify é omitido.

```text
cloud/
  compose/          # referência local (dev); produção não usa compose
  config/           # stack.example.json (copie para stack.json)
  lib/              # cliente HTTP Coolify/Cloudflare + state
  stacks/           # postgres, redis, evolution, runtime, website-pages, studio-pages
  scripts/          # bootstrap | plan | apply | deploy | website | studio
```

## Pré-requisitos

1. Token Coolify: **Keys & Tokens → API tokens** com abilities `read`, `write`, `deploy`
2. Node 22+ e `npm install` na raiz do monorepo
3. Imagem da API publicada (CD em `.github/workflows/cd-runtime.yml`, ou push local abaixo) **antes** do primeiro `apply`

## Setup rápido

```bash
cp cloud/.env.example cloud/.env
# edite COOLIFY_API_TOKEN, RUNTIME_IMAGE_NAME, GEMINI_API_KEY, JWT_SECRET

cp cloud/config/stack.example.json cloud/config/stack.json
# opcional: ajuste nomes / domínios

npm run cloud:bootstrap   # resolve server + cria projeto "namao"
npm run cloud:plan        # dry-run
npm run cloud:apply       # cria/atualiza Postgres + Redis + Evolution + API + grava cloud/state.json
npm run cloud:deploy      # GET /api/v1/deploy?uuid=...
# force rebuild:
npm run cloud:deploy -- --force
```

`cloud/.env` e `cloud/state.json` estão no `.gitignore`.

O loader lê **primeiro** o `.env` da raiz do monorepo e depois `cloud/.env` (override).

## PostgreSQL

O `apply` cria o banco `namao-postgres` (`postgres:16-alpine`) no mesmo destination Docker da API e monta:

```text
postgresql://USER:PASSWORD@<uuid-do-banco>:5432/namao
```

A Evolution aponta para o mesmo host com `?schema=evolution_api` (Prisma separado do schema `public` da API).

A senha é gerada na primeira vez e gravada em `cloud/state.json` (`postgres_password`). Opcional no `cloud/.env`:

```env
POSTGRES_USER=namao
POSTGRES_PASSWORD=
POSTGRES_DB=namao
```

Para **não** criar o recurso Coolify (Postgres gerenciado), defina `DATABASE_URL` com um host alcançável pela VPS — não use `localhost`.

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

Com a zona `namaocriativa.com.br` **na mesma conta**, `npm run cloud:pages` anexa os hostnames no Pages e tenta criar os CNAMEs (flattening no apex):

| Hostname | Projeto | Alvo |
|----------|---------|------|
| `namaocriativa.com.br` + `www` | `namao-website` | `namao-website.pages.dev` |
| `studio.namaocriativa.com.br` | `namao-studio` | `namao-studio.pages.dev` |

O token precisa de **Zone.Zone Read** + **Zone.DNS Edit** além de Pages Edit. Sem isso o Pages ainda recebe o domínio customizado; o CNAME você cria no dashboard.

No runtime da API: `NAMAO_PUBLIC_URL=https://namaocriativa.com.br` e `NAMAO_STUDIO_URL=https://studio.namaocriativa.com.br` (CORS).

### Deploy local (opcional)

```bash
npm run website:redirects -w @namao/cloud
npm run build -w @namao/website
npx wrangler pages deploy apps/website/dist --project-name=namao-website
```

## CD — Cloudflare Pages (`@namao/studio`)

Painel interno Vite em [`apps/studio`](../apps/studio). Projeto Pages **separado** do website; o HTML exige cookie JWT (`namao_studio_token`) validado na Function.

```bash
# em cloud/.env: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID + JWT_SECRET + STUDIO_API_ORIGIN
npm run cloud:studio:plan
npm run cloud:studio
```

Isso cria (ou atualiza) o projeto `namao-studio`, grava o `*.pages.dev` em `state.json`, injeta `JWT_SECRET` / `STUDIO_API_ORIGIN` **só na produção**, desliga preview deployments e, se `STUDIO_DOMAIN` estiver setado, anexa o hostname. Sem esses valores o apply falha.

Em push/merge em `main`, [`.github/workflows/cd-studio.yml`](../.github/workflows/cd-studio.yml):

1. Detecta mudanças em `apps/studio/**` e `packages/landing-kit/**`
2. `npm run build -w @namao/landing-kit` + `npm run build -w @namao/studio`
3. Confere se o projeto Pages já tem `JWT_SECRET` e `STUDIO_API_ORIGIN` (`npm run studio:check-env -w @namao/cloud`)
4. `wrangler pages deploy` (inclui `functions/_middleware.ts`)

`workflow_dispatch` força o deploy. O `wrangler.toml` em `apps/studio/` é a config versionada.

A Function:

- Libera `/login.html` e o bundle do login
- Faz proxy same-origin das rotas da API (`Accept` não HTML) para `STUDIO_API_ORIGIN`
- Exige JWT no cookie para o proxy (exceto `POST /auth/studio/login|logout`) e para o HTML (`ADMIN` ou `OPERATOR`)
- Recusa `Origin` de outro host (CSRF entre `namaocriativa.com.br` e `studio.*`)

O mesmo `JWT_SECRET` da API Coolify precisa estar no projeto Pages.

### Secrets e variables extras

| Nome | Tipo | Valor |
|------|------|--------|
| `STUDIO_API_ORIGIN` | Variable no dashboard **e** `[vars]` em `apps/studio/wrangler.toml` | Origem da API. Direct Upload só injeta plaintext no Function se estiver no Wrangler; o dashboard sozinho não basta. |
| `JWT_SECRET` | Secret (Coolify + Pages) | O mesmo valor da API |

### DNS do studio

Incluído em `npm run cloud:pages` / `cloud:studio` (`STUDIO_DOMAIN=studio.namaocriativa.com.br`). CNAME `studio` → `namao-studio.pages.dev` se o token tiver DNS Edit.

### Deploy local (opcional)

```bash
npm run build -w @namao/landing-kit
npm run build -w @namao/studio
npx wrangler pages deploy apps/studio/dist --project-name=namao-studio
```

### Variáveis da API (aplicadas pelo `apply`)

| Variável | Obrigatória | Notas |
|----------|-------------|-------|
| `PORT` | sim | `3000` |
| `NODE_ENV` | sim | `production` |
| `JWT_SECRET` | sim | Assina login/register e o cookie do studio |
| `GEMINI_API_KEY` | sim | Google AI Studio (pipeline + chat) |
| `DATABASE_URL` | sim | Injetada pelo apply (Coolify Internal URL) |
| `REDIS_URL` | sim | Injetada pelo apply (Coolify Redis db0) |
| `NAMAO_PUBLIC_URL` | não | CORS extra do website |
| `NAMAO_STUDIO_URL` | não | CORS extra do studio |
| `STUDIO_ADMIN_EMAIL` | não | Bootstrap do primeiro ADMIN |
| `STUDIO_ADMIN_PASSWORD` | não | Senha do bootstrap (mín. 8) |
| `GA4_PROPERTY_ID` | não | dashboard de estatísticas do cliente |
| `GA4_SERVICE_ACCOUNT_JSON` | não | service account com Viewer na propriedade GA4 |

Health check Coolify: `GET /health` na porta `3000`.

## Evolution API

Application Docker image `evoapicloud/evolution-api:v2.3.7` (sem compose). Redis em `CACHE_REDIS_URI` db `/1` + prefixo `evolution`. Volume persistente `/evolution/instances`.

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

O apply grava o FQDN da API no Coolify e cria o DNS na zona Cloudflare:

```env
RUNTIME_DOMAIN=https://api.namaocriativa.com.br
# opcional se o FQDN sslip.io da API já tiver sido trocado:
# COOLIFY_SERVER_PUBLIC_IP=169.58.59.253
EVOLUTION_DOMAIN=https://evolution.namaocriativa.com.br
EVOLUTION_SERVER_URL=https://evolution.namaocriativa.com.br
NAMAO_PUBLIC_URL=https://namaocriativa.com.br
WEBSITE_DOMAIN=namaocriativa.com.br
STUDIO_DOMAIN=studio.namaocriativa.com.br
NAMAO_STUDIO_URL=https://studio.namaocriativa.com.br
```

```bash
npm run cloud:apply
npm run cloud:website
npm run cloud:studio
npm run cloud:deploy -- --force
```

`api.namaocriativa.com.br` vira um **A** DNS-only (nuvem cinza) para o IP da VPS, para o Let's Encrypt do Traefik responder no HTTP-01. Site e studio continuam CNAME proxied para Pages.

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
| `npm run cloud:website` | Cria/atualiza Pages `namao-website` + domínio + DNS |
| `npm run cloud:studio:plan` | Dry-run do Pages do studio |
| `npm run cloud:studio` | Cria/atualiza Pages `namao-studio` + JWT/API env + DNS |
| `npm run cloud:pages` | Website + studio (projetos, domínios, DNS) |

Ordem do apply: Postgres → Redis → Evolution (Application) → API (`namao-api`).

## Troubleshooting

| Sintoma | Ação |
|---------|------|
| `COOLIFY_API_TOKEN is required` | Preencha `cloud/.env` |
| `Missing server_uuid/project_uuid` | Rode `cloud:bootstrap` |
| `DATABASE_URL points to "localhost"` | Unset `DATABASE_URL` no `cloud/.env` para o apply criar o Coolify Postgres |
| `POSTGRES_PASSWORD is empty` | Banco já existe no Coolify; copie a senha para `cloud/.env` ou apague o recurso e re-aplique |
| invite-requests falha | Postgres inacessível / migrate não rodou |
| 401 Coolify | Token inválido ou sem ability |
| API pull falha | Imagem não publicada / registry privado sem login GHCR no Coolify |
| API `exited:unhealthy` + P1000 | Senha do `namao-postgres` ≠ `DATABASE_URL`. Recrie o banco (volume vazio) ou copie a senha real para `POSTGRES_PASSWORD` |
| Healthcheck Coolify falha com app no ar | A imagem precisa de `wget`/`curl` (já no `Dockerfile`) e `health_check_start_period` ≥ migrate |
| Action não faz deploy | Path filter (API inalterada) ou secrets `COOLIFY_*` / variable `COOLIFY_BASE_URL` faltando |
| Action website não faz deploy | Path filter (`apps/website` inalterado) ou `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` faltando |
| Action studio não faz deploy | Path filter (`apps/studio` inalterado) ou `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` faltando |
| Studio CD: `lightningcss` / `@tailwindcss/oxide` native binding | Binários Linux. `@namao/studio` declara `lightningcss-linux-x64-gnu` + `@tailwindcss/oxide-linux-x64-gnu`; o workflow instala no Ubuntu |
| Custom domain 522 / pendente | Anexe o hostname no Pages **antes** do CNAME; zona precisa estar na mesma conta |
| DNS: zona não listada | Token sem *Zone.DNS Edit* / *Zone.Zone Read*, ou domínio noutra conta Cloudflare |
| Studio redireciona sempre para login | `JWT_SECRET` do Pages diferente da API, ou cookie sem `Secure` em HTTP |
| Pages 403 no wrangler | Token sem ability *Cloudflare Pages Edit*, ou Account ID de outra conta |
| Convite / login 404 no site | `WEBSITE_API_ORIGIN` não gerou `_redirects` |
| Evolution ignora envs | Confira envs na Application; `AUTHENTICATION_API_KEY`, `DATABASE_CONNECTION_URI`, `CACHE_REDIS_URI` |
| Domain conflict 409 | Remova domínio de outro recurso ou use `force_domain_override` na UI |

## Referências

- Coolify Authorization: https://coolify.io/docs/api-reference/api/authorization
- Create PostgreSQL: https://coolify.io/docs/api-reference/api/databases/create-database-postgresql
- Create Service: https://coolify.io/docs/api-reference/api/services/create-service
- Deploy by UUID: https://coolify.io/docs/api-reference/api/deployments/deploy-by-tag-or-uuid
- GHCR: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
- Cloudflare Pages (direct upload): https://developers.cloudflare.com/pages/get-started/direct-upload/
- Cloudflare Pages API: https://developers.cloudflare.com/api/resources/pages/subresources/projects/methods/create/
- Evolution env vars: https://evolutionapi-evolution-api-90.mintlify.app/deployment/environment-variables
