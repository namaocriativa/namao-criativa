# Namão Criativa

Site público da Namão Criativa (marketing, software, chatbots e AI) + cadastro/login dos leads convidados.

Projeto Vite no monorepo. Produção: **Cloudflare Pages** (`namao-website`).

## Dev local

```bash
npm install
npm run dev:website
```

UI em `http://localhost:5174`. A API unificada deve estar em `http://localhost:3000`. O Vite faz proxy das rotas `/auth`, `/invites`, `/leads`, `/dashboard/analytics`, `/invite-requests` e `/namao-chat`.

Build:

```bash
npm run build -w @namao/website
npm run preview -w @namao/website
```

## Deploy Cloudflare Pages

IaC (cria o projeto Pages + domínio opcional):

```bash
# CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID em cloud/.env
npm run cloud:website
```

CD em push para `main` quando `apps/website/**` muda: [`.github/workflows/cd-website.yml`](../../.github/workflows/cd-website.yml).

- Projeto: `namao-website` ([`wrangler.toml`](wrangler.toml))
- Build: `npm run build -w @namao/website` → `dist/`
- Proxy same-origin: `_redirects` gerado na Action a partir de `WEBSITE_API_ORIGIN`

Secrets e DNS: [`cloud/README.md`](../../cloud/README.md#cd--cloudflare-pages-namaowebsite).

## Fluxo do lead

1. O time interno gera um convite no studio de enrichment.
2. O lead abre `/register.html?invite=TOKEN` e cria conta (JWT).
3. Em `/conectar.html` autoriza o Instagram (OAuth Graph). Só contas que autorizarem enviam mídia.
4. Em `/dashboard.html` vê os dados do negócio e as estatísticas do site publicado (GA4, filtrado pelo hostname de `publishedOrigin`).

O proxy Vite (e o `_redirects` do Pages) encaminha `/dashboard/analytics` e `/namao-chat` à API. Setup GTM/GA4: [README da raiz](../../README.md#gtm--google-analytics-landings--dashboard).

## Chat da home

Visitante anônimo: FAQ via Gemini, cadastro (nome, e-mail, Instagram) e encaminhamento para WhatsApp (`NAMAO_WHATSAPP`). Depois do login o widget muda de cor/formato, vira assistente da conta e retoma o histórico.

Avatar: usa `apps/website/public/logo-icon-with-effects.png`.

## Instagram / Meta

Ver `services/platform/.env.example` (`META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`).
