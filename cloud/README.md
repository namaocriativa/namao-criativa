# Coolify IaC — Namão

Provisiona via [API do Coolify](https://coolify.io/docs/api-reference/api/authorization) em [coolify.fungalia.com.br](https://coolify.fungalia.com.br/):

| Recurso | Tipo Coolify | Conteúdo |
|---------|--------------|----------|
| `namao-mongodb` | Service (compose) | MongoDB 7 + replica set `rs0` (Prisma) |
| `namao-evolution` | Service (compose) | `evoapicloud/evolution-api:latest` + Postgres + Redis |
| `namao-runtime` | Application (Docker image) | `@namao/runtime` — chat público |

```text
cloud/
  compose/          # YAML versionados → base64 em docker_compose_raw
  config/           # stack.example.json (copie para stack.json)
  lib/              # cliente HTTP + state
  stacks/           # apply de cada recurso
  scripts/          # bootstrap | plan | apply | deploy
```

## Pré-requisitos

1. Token Coolify: **Keys & Tokens → API tokens** com abilities `read`, `write`, `deploy`
2. Node 22+ e `npm install` na raiz do monorepo
3. Imagem do runtime publicada (ver abaixo) **antes** do primeiro `apply` do runtime

## Setup rápido

```bash
cp cloud/.env.example cloud/.env
# edite COOLIFY_API_TOKEN, RUNTIME_IMAGE_NAME, GEMINI_API_KEY, JWT_SECRET

cp cloud/config/stack.example.json cloud/config/stack.json
# opcional: ajuste nomes / domínios

npm run cloud:bootstrap   # resolve server + cria projeto "namao"
npm run cloud:plan        # dry-run
npm run cloud:apply       # cria/atualiza recursos + grava cloud/state.json
npm run cloud:deploy      # GET /api/v1/deploy?uuid=...
# force rebuild:
npm run cloud:deploy -- --force
```

`cloud/.env` e `cloud/state.json` estão no `.gitignore`.

## Build e push da imagem `@namao/runtime`

O Coolify **não** faz build do monorepo neste fluxo — ele puxa uma imagem pronta.

Na raiz do monorepo:

```bash
# substitua YOUR_ORG / tag
export IMAGE=ghcr.io/YOUR_ORG/namao-runtime
export TAG=latest

docker build \
  -f services/runtime/Dockerfile \
  --target production \
  -t "$IMAGE:$TAG" \
  .

# GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USER --password-stdin
docker push "$IMAGE:$TAG"
```

No `cloud/.env`:

```env
RUNTIME_IMAGE_NAME=ghcr.io/YOUR_ORG/namao-runtime
RUNTIME_IMAGE_TAG=latest
```

Se a imagem for **privada**, configure o registry login no Coolify (Server → Destinations / Docker Registry) com um token GHCR `read:packages`.

### Variáveis do runtime (aplicadas pelo `apply`)

| Variável | Obrigatória | Notas |
|----------|-------------|-------|
| `PORT` | sim | `3001` |
| `NODE_ENV` | sim | `production` |
| `JWT_SECRET` | sim | **mesmo valor** do platform |
| `GEMINI_API_KEY` | sim (chat) | Google AI Studio |
| `MONGODB_URL` | condicional | gerada do stack Mongo (invite-requests) |
| `DATABASE_URL` | **sim em prod** | DB Prisma do **platform** — ver aviso abaixo |
| `REDIS_URL` | recomendada | rate limit |
| `NAMAO_PUBLIC_URL` | não | CORS extra |

Health check Coolify: `GET /health` na porta `3001`.

### Aviso crítico: `DATABASE_URL`

O runtime usa o schema Prisma do platform (leads, chat sessions, users). **SQLite em `localhost` não funciona** a partir de um container na VPS.

Opções:

1. **Curto prazo:** runtime na nuvem só para health/Gemini; leave `DATABASE_URL` placeholder até o platform subir no Coolify
2. **Recomendado (fase 2):** deploy do platform no mesmo projeto Coolify com volume/DB compartilhado (ou migrar para Postgres) e apontar `DATABASE_URL` dos dois serviços para o mesmo banco

Defina no `cloud/.env`:

```env
DATABASE_URL=...
```

## MongoDB (Prisma)

Compose: [`compose/mongodb.yml`](compose/mongodb.yml) — `--replSet rs0` + job `mongo-init`.

Connection string injetada no runtime:

```text
mongodb://root:PASSWORD@mongodb:27017/namao?authSource=admin&replicaSet=rs0&directConnection=true
```

O hostname `mongodb` é o nome do serviço no compose (rede interna Coolify).

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
RUNTIME_DOMAIN=https://runtime.namaocriativa.com.br
EVOLUTION_DOMAIN=https://evolution.namaocriativa.com.br
EVOLUTION_SERVER_URL=https://evolution.namaocriativa.com.br
NAMAO_PUBLIC_URL=https://namaocriativa.com.br
```

```bash
npm run cloud:apply
npm run cloud:deploy -- --force
```

No platform:

```env
PUBLIC_CHAT_API_ORIGIN=https://runtime.namaocriativa.com.br
```

## Fluxo operacional

| Comando | Efeito |
|---------|--------|
| `npm run cloud:bootstrap` | Lista servers; cria projeto `namao` + resolve environment |
| `npm run cloud:plan` | Dry-run (não grava state) |
| `npm run cloud:apply` | Idempotente create/update + `state.json` |
| `npm run cloud:deploy` | Dispara deploy dos UUIDs no state |

Ordem do apply: MongoDB → Evolution → Runtime.

## Troubleshooting

| Sintoma | Ação |
|---------|------|
| `COOLIFY_API_TOKEN is required` | Preencha `cloud/.env` |
| `Missing server_uuid/project_uuid` | Rode `cloud:bootstrap` |
| 401 Coolify | Token inválido ou sem ability |
| Runtime pull falha | Imagem não publicada / registry privado sem login |
| Prisma Mongo “replica set” | Confira logs do `mongo-init`; redeploy do service |
| Evolution ignora envs | Confira envs no Coolify UI; `AUTHENTICATION_API_KEY` e `DATABASE_CONNECTION_URI` |
| Domain conflict 409 | Remova domínio de outro recurso ou use `force_domain_override` na UI |

## Referências

- Coolify Authorization: https://coolify.io/docs/api-reference/api/authorization
- Create Docker Image app: https://coolify.io/docs/api-reference/api/applications/create-docker-image
- Create Service: https://coolify.io/docs/api-reference/api/services/create-service
- Deploy by UUID: https://coolify.io/docs/api-reference/api/deployments/deploy-by-tag-or-uuid
- Evolution env vars: https://evolutionapi-evolution-api-90.mintlify.app/deployment/environment-variables
