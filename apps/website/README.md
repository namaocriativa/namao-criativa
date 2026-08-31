# Namão Criativa

Site público da Namão Criativa (marketing, software, chatbots e AI) + cadastro/login dos leads convidados.

Projeto Vite no monorepo. Root Directory na Vercel: `apps/website`.

## Dev local

```bash
npm install
npm run dev:website
```

UI em `http://localhost:5174`. A API platform deve estar em `http://localhost:3000`.

Build:

```bash
npm run build -w @namao/website
npm run preview -w @namao/website
```

## Deploy Vercel

- Framework Preset: Vite
- Root Directory: `apps/website`
- Build Command: `npm run build`
- Output Directory: `dist`

Opcional: `VITE_API_URL` se a API não estiver no mesmo domínio.

## Fluxo do lead

1. O time interno gera um convite no studio de enrichment.
2. O lead abre `/register.html?invite=TOKEN` e cria conta (JWT).
3. Em `/conectar.html` autoriza o Instagram (OAuth Graph). Só contas que autorizarem enviam mídia.

## Instagram / Meta

Ver `services/platform/.env.example` (`META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`).
