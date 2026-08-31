# Namão — lead discovery & enrichment

Monorepo para **descobrir leads** em uma região, **enriquecê-los** com dados e imagens reais (SQLite + storage local) e gerar landing pages independentes.

## Stack

- Studio interno: Vite + TypeScript (`apps/studio/`)
- Website Namão: Vite (`apps/website/`) — marketing + cadastro/login
- Platform API: NestJS (`services/platform/`) — discovery, enrichment, geração de LP
- Runtime API: NestJS (`services/runtime/`) — chat IA com Gemini, endpoint público na nuvem
- Prisma + SQLite (`services/platform/prisma/dev.db`, compartilhado com o runtime)
- Imagens em `services/platform/storage/leads/{leadId}/images`
- Landings geradas em `leads/<slug>/` (independentes, fora dos workspaces)
- Crawl4AI para enrichment quando o lead já tem website (`services/platform/crawler/` ou Docker opcional)

Postgres não é obrigatório. Docker sobe Redis, Crawl4AI, Ollama e as APIs Nest (watch). O Vite em `apps/studio/` continua no host e faz proxy para `http://localhost:3000`.

## Estrutura

```text
apps/
  studio/              # UI interna Vite
  website/             # site Namão + cadastro/login
services/
  platform/            # API interna NestJS + Prisma + storage
    src/
    crawler/           # script Python do Crawl4AI
    prisma/
    storage/
  runtime/             # API pública (chat Gemini) — deploy na nuvem
packages/
  landing-kit/         # componentes + PageSpec
cloud/                 # IaC Coolify (runtime, MongoDB, Evolution) — ver cloud/README.md
leads/                 # projetos Vite gerados (Root Directory na Vercel)
docker-compose.yml     # Redis + Crawl4AI + Ollama + APIs Nest (watch)
```

## Setup

```bash
npm install
cp services/platform/.env.example services/platform/.env
cp services/runtime/.env.example services/runtime/.env
docker compose up -d --build
npm run dev:studio
```

- Studio (Vite em `apps/studio/`): `http://localhost:5173` — proxy `/leads`, `/config`, etc. → API na 3000
- Platform (NestJS no Docker): `http://localhost:3000` — discovery/enrichment/landing, com hot reload de `services/platform/src`
- Runtime (NestJS no Docker): `http://localhost:3001` — chat Gemini, com hot reload de `services/runtime/src`

Para rodar as APIs Nest no host em vez do Docker: `npm run dev` (sobe platform + studio + runtime). Não use host e Docker ao mesmo tempo nas mesmas portas (3000 / 3001).

### Variáveis de ambiente

Arquivo principal: `services/platform/.env` (runtime usa `services/runtime/.env`)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | Default: `file:./dev.db` |
| `PORT` | Não | Default: `3000` |
| `REDIS_URL` | Não | Cache de discovery. Default local: `redis://localhost:6379`. Sem Redis, discovery segue sem cache |
| `GOOGLE_PLACES_API_KEY` | Não | Se definida, discovery/enrich usam Google Places; senão, Overpass/OSM (negócios) + Nominatim |
| `CRAWL4AI_URL` | Não | API Docker do Crawl4AI, ex.: `http://localhost:11235`. Se vazia, usa o script Python local |
| `CRAWL4AI_API_TOKEN` | Não | Bearer token se o servidor Docker exigir JWT |
| `CRAWL4AI_PYTHON` | Não | Python do venv do crawler. Default: `services/platform/crawler/.venv/bin/python` |
| `OLLAMA_URL` | Não | API do Ollama. Default: `http://localhost:11434` (no compose: `http://ollama:11434`) |
| `OLLAMA_MODEL` | Não | Modelo para gerar landing. Default: `qwen2.5-coder:7b` |
| `PUBLIC_CHAT_API_ORIGIN` | Sim em LP publicada | URL absoluta do runtime injetada no widget. Dev: `http://localhost:3001` |
| `VERCEL_TOKEN` | Sim para publicar | Token da conta Vercel (`vercel.com/account/tokens`). Com ele, o `dist/` de cada lead é publicado depois do build |
| `VERCEL_TEAM_ID` | Não | Team/org da Vercel, se os projetos não forem da conta pessoal |
| `VERCEL_AUTO_DEPLOY` | Não | Default: liga sozinho quando há token. `false` publica só no botão |
| `LEADS_DIR` | Não | Pasta dos projetos Vite. Default: `<monorepo>/leads` |
| `JWT_SECRET` | Sim em produção | Segredo JWT (login Namão / clientes) |
| `NAMAO_PUBLIC_URL` | Não | URL do site Namão. Default: `http://localhost:5174` |
| `META_APP_ID` / `META_APP_SECRET` | Não | App Meta para OAuth Instagram Graph |
| `META_REDIRECT_URI` | Não | Callback OAuth. Default: `http://localhost:3000/auth/instagram/callback` |
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

### Ollama (geração de landing)

Sobe o serviço e baixa o modelo (uma vez):

```bash
docker compose up -d ollama
docker exec -it ollama ollama pull qwen2.5-coder:7b
```

No `server/.env` (dev no host):

```bash
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:7b
```

Na UI, abra um lead e use **Gerar site** (um clique: scaffold se necessário + pipeline Ollama + build). Há preview embutido após build OK, cancelamento de job e badge de status na lista.

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
GET  /auth/me
GET  /auth/instagram/start
GET  /auth/instagram/callback
GET  /auth/instagram/status
POST /auth/instagram/sync
POST /invites
GET  /invites/:token
POST /invites/:id/send-whatsapp
POST /leads/:id/instagram/sync
```

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

### Landing (Ollama)

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
| `npm run dev` | Sobe platform + studio + runtime |
| `npm run dev:platform` | Só a API platform |
| `npm run dev:runtime` | Só a API runtime (chat Gemini na :3001) |
| `npm run dev:studio` | Só o studio Vite |
| `npm run dev:website` | Só o site Namão (:5174) |
| `npm run build` | Build de platform, runtime, studio e landing-kit |
| `npm run prisma:migrate` | Migrações Prisma |
| `npm run crawler:setup` | Cria venv e instala Crawl4AI + Chromium |
| `npm run cloud:bootstrap` | Resolve server/projeto no Coolify |
| `npm run cloud:plan` | Dry-run do IaC Coolify |
| `npm run cloud:apply` | Cria/atualiza MongoDB, Evolution e runtime |
| `npm run cloud:deploy` | Dispara deploy dos recursos no Coolify |

## Runtime API (chat público)

Servidor em `services/runtime/` para features dos clientes que precisam de backend. Roda na nuvem, usa **Gemini** (nada local) e reutiliza o mesmo Prisma/Redis.

```bash
cp services/runtime/.env.example services/runtime/.env
# defina GEMINI_API_KEY
npm run dev:runtime
```

Endpoints públicos:

```http
GET  /health
POST /public/chat/session
POST /public/chat
POST /public/chat/events
```

Segurança: CORS por `publishedOrigin`, sessão com token hasheado, rate limit por IP/sessão/site, DTO sem `model`/`systemPrompt`, IP hasheado. Na nuvem, `trust proxy` lê `X-Forwarded-For`.

Deploy: `services/runtime/Dockerfile`. Em produção, `PUBLIC_CHAT_API_ORIGIN` em `services/platform/.env` deve ser a URL pública do runtime.

## Coolify (produção na VPS)

IaC em [`cloud/`](cloud/README.md) via API HTTP do Coolify (`https://coolify.fungalia.com.br`):

- MongoDB com replica set (Prisma / invite-requests)
- Evolution API (`evoapicloud/evolution-api:latest`) + Postgres + Redis
- Runtime como aplicação Docker image (build/push GHCR → Coolify pull)

```bash
cp cloud/.env.example cloud/.env
npm run cloud:bootstrap
npm run cloud:apply
```

**Importante:** o runtime na nuvem precisa de `DATABASE_URL` apontando para o mesmo banco Prisma do platform (SQLite local não funciona entre máquinas). Detalhes e wiring de `EVOLUTION_*` / `PUBLIC_CHAT_API_ORIGIN` em [`cloud/README.md`](cloud/README.md).

This project uses Crawl4AI (https://github.com/unclecode/crawl4ai) for web data extraction.

## Regras da v1

- Não inventa informações
- Preserva origem em `LeadSource`
- Imagens só como metadados + caminho local no banco
- Landings em `leads/` são projetos Vite autônomos (não entram nos workspaces)
