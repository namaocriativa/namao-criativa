# Namão Criativa

Site público da Namão Criativa (marketing, software, chatbots e AI) + cadastro/login dos leads convidados.

Projeto Vite no monorepo. Produção: **Cloudflare Pages** (`namao-website`).

## Dev local

```bash
npm install
npm run dev:website
```

UI em `http://localhost:5174`. A API unificada deve estar em `http://localhost:4000` (ou `PLATFORM_PORT` / `VITE_API_URL`). O Vite faz proxy das rotas `/auth`, `/invites`, `/leads`, `/dashboard/analytics`, `/invite-requests` e `/namao-chat`.

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
- Proxy same-origin: Pages Function `functions/_middleware.ts` (o `_redirects` 200 para origem externa não funciona no Pages)

Secrets e DNS: [`cloud/README.md`](../../cloud/README.md#cd--cloudflare-pages-namaowebsite).

## Fluxo do lead

1. O time interno gera um convite no studio de enrichment.
2. O lead abre `/register.html?invite=TOKEN` e cria conta (cookie HttpOnly).
3. Em `/conectar.html` autoriza o Instagram (OAuth Graph). Só contas que autorizarem enviam mídia.
4. Em `/dashboard.html` vê os dados do negócio e as estatísticas do site publicado (GA4, filtrado pelo hostname de `publishedOrigin`).

O proxy Vite (e a Function do Pages) encaminha `/dashboard/analytics` e `/namao-chat` à API. Setup GTM/GA4 das **landings de clientes**: [README da raiz](../../README.md#gtm--google-analytics-landings--dashboard).

## SEO e busca

Metas, canonical, JSON-LD e `sitemap.xml` saem do registro em [`seo/pages.ts`](seo/pages.ts). Testes: `npm test -w @namao/website`.

Páginas públicas: `/`, `/sobre`, `/servicos` (e as quatro frentes), `/cases`, `/faq`, termos e privacidade. Login, cadastro, painel e Instagram ficam com `noindex`.

`www.namaocriativa.com.br` redireciona 301 para o apex na Function [`functions/_middleware.ts`](functions/_middleware.ts).

### Depois do deploy (manual)

1. **Search Console e Bing Webmaster:** verificação por registro TXT na zona Cloudflare (`namaocriativa.com.br`). Envie `https://namaocriativa.com.br/sitemap.xml` e peça indexação da home e de `/servicos`.
2. **Google Perfil da Empresa:** categoria Agência de marketing / criação de sites; área de serviço (Leme, Limeira, Araras, Pirassununga, Campinas) se não houver loja física. Mesmo NAP do rodapé (WhatsApp `+55 19 99730-6695`, e-mail `contato@namaocriativa.com.br`). Link para o site apex. Peça avaliações reais dos clientes.
3. **Instagram oficial:** preencha `INSTAGRAM_HANDLE` em [`seo/site.ts`](seo/site.ts) (sem `@`). O rodapé e o `sameAs` do JSON-LD só aparecem com handle. Não deixe o link genérico `instagram.com`.
4. **GTM/GA4 do site institucional:** crie (ou reutilize) um container com trigger de hostname `namaocriativa.com.br` — separado das landings, ou o mesmo container filtrado por host. Defina a variável de repositório `WEBSITE_GTM_CONTAINER_ID` (`GTM-XXXX`). O CD injeta `VITE_WEBSITE_GTM_ID` no build; páginas `noindex` não recebem o snippet.
5. **PageSpeed:** conferir home e `/servicos` no mobile depois do ar. Hero usa poster + loop comprimido; WebGL só depois do idle.

Assets OG/poster/vídeo: `npm run assets:seo -w @namao/website` (Python + ffmpeg; fonte do vídeo em `assets/hero-source.mp4`).

## Chat da home

Visitante anônimo: FAQ via Gemini, cadastro (nome, e-mail, Instagram) e encaminhamento para WhatsApp (`NAMAO_WHATSAPP`). Depois do login o widget muda de cor/formato, vira assistente da conta e retoma o histórico.

Avatar: usa `apps/website/public/logo-mark.png`.

## Instagram / Meta

Ver `services/platform/.env.example` (`META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`).
