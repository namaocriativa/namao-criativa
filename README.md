# Namão — lead discovery & enrichment

Monorepo para **descobrir leads** em uma região, **enriquecê-los** com dados e imagens reais (PostgreSQL + storage local) e gerar landing pages independentes.

## Stack

- Studio interno: Vite + TypeScript (`apps/studio/`)
- Website Namão: Vite (`apps/website/`) — marketing + cadastro/login
- API NestJS (`services/platform/`) — discovery, enrichment, geração de LP, chat Gemini, dashboard, convites
- Prisma + PostgreSQL
- Imagens em `services/platform/storage/leads/{leadId}/images`
- Landings geradas em `leads/<slug>/` (independentes, fora dos workspaces)
- Crawl4AI para enrichment quando o lead já tem website (`services/platform/crawler/` ou Docker opcional)

Docker sobe Postgres, Redis, Crawl4AI e a API Nest (watch). O Vite em `apps/studio/` continua no host e faz proxy para a API (`PLATFORM_PORT`, default `http://localhost:4000`). As portas no host (4000 e 5433) evitam conflito com stacks na 3000/5432.

## Estrutura

```text
apps/
  studio/              # UI interna Vite
  website/             # site Namão + cadastro/login
services/
  platform/            # API NestJS unificada + Prisma + storage
    src/
    crawler/           # script Python do Crawl4AI
    prisma/
    storage/
packages/
  landing-kit/         # componentes + PageSpec
cloud/                 # IaC Coolify + Cloudflare Pages — ver cloud/README.md
leads/                 # projetos Vite gerados (Root Directory na Vercel)
docker-compose.yml     # Postgres + Redis + Crawl4AI + API Nest (watch)
```

## Setup

```bash
npm install
cp services/platform/.env.example services/platform/.env
docker compose up -d --build
npm run dev:studio
```

- Studio (Vite em `apps/studio/`): `http://localhost:5173` — login JWT, proxy `/leads`, `/config`, `/studio`, etc. → API (`PLATFORM_PORT`, default 4000)
- API (NestJS no Docker): `http://localhost:${PLATFORM_PORT:-4000}` — discovery, landing, chat Gemini, dashboard, com hot reload de `services/platform/src`

Para rodar a API Nest no host em vez do Docker: `npm run dev` (sobe platform + studio). Não use host e Docker ao mesmo tempo na mesma porta.

O Compose publica a API em **4000** e o Postgres em **5433** no host (o Nest continua em 3000 *dentro* do container). No `.env` da raiz:

```bash
PLATFORM_PORT=4000
POSTGRES_PORT=5433
```

```bash
docker compose up -d --build
npm run dev:studio
```

Studio e website falam com `http://localhost:4000`. API Nest no host, sem o serviço `platform` do Compose: `PORT=4000` em `services/platform/.env`.

### Variáveis de ambiente

Arquivo: `services/platform/.env`

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | Postgres, ex.: `postgresql://namao:namao@localhost:5433/namao` (Docker publica 5433 no host) |
| `PORT` | Não | Porta do Nest no **host** (sem Docker). Default: `3000` |
| `PLATFORM_PORT` | Não | Porta no **host** com Docker (`4000:3000`). Definir no `.env` da **raiz**. Default: `4000` |
| `REDIS_URL` | Não | Cache de discovery e rate limit. Default local: `redis://localhost:6379` |
| `GOOGLE_PLACES_API_KEY` | Não | Se definida, discovery/enrich usam Google Places; senão, Overpass/OSM + Nominatim |
| `CRAWL4AI_URL` | Não | API Docker do Crawl4AI, ex.: `http://localhost:11235`. Se vazia, usa o script Python local |
| `CRAWL4AI_API_TOKEN` | Não | Bearer token se o servidor Docker exigir JWT |
| `CRAWL4AI_PYTHON` | Não | Python do venv do crawler. Default: `services/platform/crawler/.venv/bin/python` |
| `GEMINI_API_KEY` | Sim para gerar/chat | Google AI Studio |
| `PUBLIC_CHAT_API_ORIGIN` | Sim em LP publicada | URL absoluta da API injetada no widget. Dev: `http://localhost:4000` |
| `VERCEL_TOKEN` | Sim para publicar | Token da conta Vercel (`vercel.com/account/tokens`) |
| `VERCEL_TEAM_ID` | Não | Team/org da Vercel, se os projetos não forem da conta pessoal |
| `VERCEL_AUTO_DEPLOY` | Não | Default: liga sozinho quando há token. `false` publica só no botão |
| `GTM_CONTAINER_ID` | Não | Container GTM compartilhado (ex. `GTM-XXXX`) injetado no HTML das landings |
| `GA4_PROPERTY_ID` | Não | Property ID numérico do GA4 — dashboard do cliente |
| `GA4_SERVICE_ACCOUNT_JSON` | Não | JSON da service account (Viewer na propriedade GA4) |
| `LEADS_DIR` | Não | Pasta dos projetos Vite. Default: `<monorepo>/leads` |
| `JWT_SECRET` | Sim em produção | Segredo JWT (login Namão / clientes / studio) |
| `NAMAO_PUBLIC_URL` | Não | URL do site Namão. Default: `http://localhost:5174` |
| `NAMAO_STUDIO_URL` | Não | URL do studio (CORS). Default local: `http://localhost:5173` |
| `STUDIO_ADMIN_EMAIL` | Não | Bootstrap do primeiro admin do studio |
| `STUDIO_ADMIN_PASSWORD` | Não | Senha do bootstrap (mínimo 8 caracteres) |
| `META_APP_ID` / `META_APP_SECRET` | Não | App Meta para OAuth Instagram Graph |
| `META_REDIRECT_URI` | Não | Callback OAuth. Default: `http://localhost:4000/auth/instagram/callback` |
| `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` / `EVOLUTION_INSTANCE` | Não | Evolution API; sem isso o envio WhatsApp fica `not_configured` |

### Redis (cache de discovery)

Sobe o Redis (já incluso em `docker compose up`). Se a API Nest estiver no host:

```bash
docker compose up -d redis
```

No `services/platform/.env`:

```bash
REDIS_URL=redis://localhost:6379
```

Respostas de discovery ficam em cache sem TTL até clicar em **Limpar cache** na UI. Sem Redis, o discovery funciona normalmente sem cache.

### GTM / Google Analytics (landings + dashboard)

Um container GTM e uma propriedade GA4 da Namão cobrem todos os sites publicados. O cliente vê as estatísticas do **próprio hostname** depois do login em `apps/website` (`/dashboard.html`).

Setup uma vez no Google:

1. Crie uma propriedade GA4 (ex. “Namão Landings”) e um data stream Web.
2. Crie um container GTM. Tag de configuração GA4 + page view. Eventos opcionais do dataLayer: `whatsapp_click`, `cta_click`, `chat_open`. Dimensões personalizadas opcionais: `lead_id`, `site_id`, `landing_slug`.
3. No GCP, ative a **Google Analytics Data API**, crie uma service account e conceda **Viewer** na propriedade GA4. Cole o JSON da key em `GA4_SERVICE_ACCOUNT_JSON` (uma linha).
4. API: `GTM_CONTAINER_ID=GTM-XXXX`, `GA4_PROPERTY_ID` (só o número) e `GA4_SERVICE_ACCOUNT_JSON`.
5. **Republique** as landings já no ar. Sites novos recebem o snippet na geração; o publish também injeta no `dist/index.html` se o GTM ainda não estiver lá.

O dashboard chama `GET /dashboard/analytics?range=7d|28d|90d` (JWT). Sem `publishedOrigin`, a UI mostra que o site ainda não foi publicado. O GA4 pode atrasar até ~24h após as primeiras visitas.

### Crawl4AI (leads com website)

Quando o lead já tem `website`, o enrichment usa o [Crawl4AI](https://github.com/unclecode/crawl4ai) (Playwright) na homepage e em páginas de contato/sobre/serviços. Se o crawler não estiver disponível, cai no parser HTTP + Cheerio.

**Opção A — Python local**

```bash
npm run crawler:setup
```

**Opção B — Docker**

```bash
docker compose up -d crawl4ai
```

No `services/platform/.env`:

```bash
CRAWL4AI_URL=http://localhost:11235
```

### Gemini (geração de landing)

Defina `GEMINI_API_KEY` em `services/platform/.env` (https://aistudio.google.com/apikey). Na aba Config do studio escolha o modelo por papel (default: `gemini-2.5-flash`).

Na UI, abra um lead e use **Gerar site** (um clique: scaffold se necessário + pipeline Gemini + build). Há preview embutido após build OK, cancelamento de job e badge de status na lista.

Enrichment faz **dedupe**: se já existir lead com o mesmo website (host) ou mesmo `nome+cidade+estado`, atualiza o existente em vez de criar outro.

### Política de `leads/`

Versionar fontes de exemplo (`index.html`, `src/`, `public/` sem binários pesados). **Não** versionar `node_modules/`, `dist/`, `.landing-pipeline/` nem `.vercel/` (já no `.gitignore`).

### Locations (autocomplete)

```http
GET /locations/cities?q=Sao&limit=8
```

Retorna municípios do IBGE (`[{ id, name, state, label }]`), ex.: `São Paulo-SP`.

```http
GET /locations/neighborhoods?city=Rio%20de%20Janeiro&state=RJ&q=Copa&limit=8
```

Retorna bairros via Nominatim (`[{ name, city, state, label, latitude, longitude, bbox }]`).

## Endpoints

### Discovery

```http
POST /lead-discovery
Content-Type: application/json

{
  "city": "São Paulo",
  "state": "SP",
  "category": "restaurantes",
  "neighborhood": "Pinheiros",
  "radiusKm": 5,
  "limit": 100
}
```

`category`, `neighborhood` e `radiusKm` são opcionais (`radiusKm` default 5, máx. 30). Com chave do Google, Places e OSM rodam juntos e o resultado é deduplicado. Sem bairro, a busca usa o centro da cidade + raio. Retorna `{ "results": [ ... ], "cached": false, "geo": { "mode": "neighborhood"|"radius", "radiusKm": 5 } }` sem persistir.

### Enrichment (síncrono)

```http
POST /enrichment
Content-Type: application/json

{
  "name": "Empresa Exemplo Ltda",
  "city": "São Paulo",
  "state": "SP",
  "website": "https://exemplo.com.br",
  "instagram": "@empresaexemplo"
}
```

Cria o lead, consulta providers, mescla dados, baixa imagens e devolve o lead completo (com `images` e `sources`).

### Auth, convites e Instagram

```http
POST /auth/register
POST /auth/login
POST /auth/studio/login
POST /auth/studio/logout
GET  /auth/me
GET  /studio/users
POST /studio/users
PATCH /studio/users/:id
POST /studio/users/:id/reset-password
DELETE /studio/users/:id
GET  /auth/instagram/start
GET  /auth/instagram/callback
GET  /auth/instagram/status
POST /auth/instagram/sync
POST /invites
GET  /invites/:token
POST /invites/:id/send-whatsapp
POST /leads/:id/instagram/sync
```

O studio usa cookie HttpOnly (`namao_studio_token`) em `POST /auth/studio/login` (só `ADMIN`/`OPERATOR`). Clientes do website continuam com `POST /auth/login` + Bearer. Gestão de usuários do studio é só `ADMIN`. O primeiro admin pode ser criado com `STUDIO_ADMIN_EMAIL` / `STUDIO_ADMIN_PASSWORD`.

Cadastro de cliente exige `inviteToken`. O OAuth Instagram só funciona com `META_APP_ID` / `META_APP_SECRET`. `POST /invites/:id/send-whatsapp` chama a Evolution se estiver configurada; senão retorna `{ skipped: true, reason: "not_configured" }`.

Site público: `apps/website/` em `http://localhost:5174` (`npm run dev:website`).

### Lead

```http
GET /leads
```

Lista todos os leads enriquecidos (mais recentes primeiro).

```http
GET /leads/:id
```

Retorna o lead persistido com imagens e fontes.

### Landing (Gemini)

```http
GET /landing/status
POST /landing/scaffold
POST /landing/prompt
POST /landing/generate
POST /landing/publish
GET /landing/jobs/:jobId
POST /landing/jobs/:jobId/cancel
GET /landing/jobs/:jobId/events
GET /landing/preview/:leadId/
```

`scaffold` / `prompt` / `generate` / `publish` recebem `{ "leadId": "..." }`.  
`generate` faz scaffold automático se a pasta não existir. Com `VERCEL_TOKEN`, o pipeline publica o `dist/` na Vercel e grava `publishedOrigin` (CORS do chat). Jobs e status ficam no Prisma; SSE em `/landing/jobs/:jobId/events` faz replay do log. Preview serve `leads/<slug>/dist` após build OK.

## Providers

| Provider | Discovery | Enrichment |
|----------|-----------|------------|
| Google Places | Sim (com API key) | Sim (com API key) |
| Crawl4AI | — | Leads com website (Playwright; homepage + contato/sobre/serviços) |
| Website | — | Fallback HTTP + Cheerio se o Crawl4AI não estiver disponível |
| Search (Nominatim/OSM) | Fallback sem key | Sim |
| Instagram / Facebook / LinkedIn | — | Stubs (preservam URLs já conhecidas) |

Falhas de um provider não interrompem o enrichment.

## Scripts

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Sobe platform + studio |
| `npm run dev:platform` | Só a API |
| `npm run dev:studio` | Só o studio Vite |
| `npm run dev:website` | Só o site Namão (:5174) |
| `npm run build` | Build de platform, studio e landing-kit |
| `npm run prisma:migrate` | Migrações Prisma |
| `npm run crawler:setup` | Cria venv e instala Crawl4AI + Chromium |
| `npm run cloud:bootstrap` | Resolve server/projeto no Coolify |
| `npm run cloud:plan` | Dry-run do IaC Coolify |
| `npm run cloud:apply` | Cria/atualiza Postgres, Evolution e API |
| `npm run cloud:deploy` | Dispara deploy dos recursos no Coolify |

## API pública (chat, dashboard, convites)

A mesma API em `services/platform/` expõe os endpoints dos clientes. Usa **Gemini** e o Postgres único.

```http
GET  /health
POST /public/chat/session
POST /public/chat
POST /public/chat/events
POST /namao-chat/session
GET  /namao-chat/history
POST /namao-chat
POST /namao-chat/events
POST /auth/login
GET  /auth/me
GET  /dashboard/analytics
POST /invite-requests
```

Segurança do chat: CORS por `publishedOrigin`, sessão com token hasheado, rate limit por IP/sessão/site, DTO sem `model`/`systemPrompt`, IP hasheado. Na nuvem, `trust proxy` lê `X-Forwarded-For`.

Em produção, `PUBLIC_CHAT_API_ORIGIN` deve ser a URL pública da API (`https://api.namaocriativa.com.br`).

## Coolify (produção na VPS)

IaC em [`cloud/`](cloud/README.md) via API HTTP do Coolify (`https://coolify.fungalia.com.br`):

- PostgreSQL (`namao-postgres` via IaC) — leads, chat, users, invite-requests
- Evolution API (`evoapicloud/evolution-api:latest`) + Postgres + Redis
- API (`namao-api`) como aplicação Docker image (`ghcr.io/namaocriativa/namao-api`). CD em push para `main`: [`.github/workflows/cd-runtime.yml`](.github/workflows/cd-runtime.yml)
- Website (`apps/website`) no Cloudflare Pages (`namao-website`). CD: [`.github/workflows/cd-website.yml`](.github/workflows/cd-website.yml)
- Studio (`apps/studio`) no Cloudflare Pages (`namao-studio`), protegido por JWT. CD: [`.github/workflows/cd-studio.yml`](.github/workflows/cd-studio.yml) — secrets e IaC em [`cloud/README.md`](cloud/README.md)

```bash
cp cloud/.env.example cloud/.env
npm run cloud:bootstrap
npm run cloud:apply
npm run cloud:website
npm run cloud:studio
```

Ou os dois de uma vez: `npm run cloud:pages`.

Detalhes e wiring de `EVOLUTION_*` / `PUBLIC_CHAT_API_ORIGIN` em [`cloud/README.md`](cloud/README.md).

This project uses Crawl4AI (https://github.com/unclecode/crawl4ai) for web data extraction.

## Regras da v1

- Não inventa informações
- Preserva origem em `LeadSource`
- Imagens só como metadados + caminho local no banco
- Landings em `leads/` são projetos Vite autônomos (não entram nos workspaces)
