# Websites de clientes

O Namao **não clona** esses sites. `catalog.json` é só uma lista de referências GitHub (documentação). O picker do Studio lê a API do GitHub com `GITHUB_WEBSITES_TOKEN`.

## Vincular no Studio

1. No lead/cliente, **Configurar site**.
2. Escolha o repositório que o token enxerga (ou ajuste um vínculo existente).
3. Escolha Cloudflare Pages ou Vercel. Dá para trocar o destino depois no mesmo modal.
4. Se o deploy for Cloudflare e a zona DNS estiver na mesma conta, preencha o **domínio** (opcional). Apex e `www` são anexados juntos.
5. **Salvar** grava a referência. **Sincronizar domínio** chama a API da Cloudflare sem rebuild. **Publicar agora** dispara `workflow_dispatch` em `.github/workflows/cd.yml`.

Push em `main` no repo do cliente continua publicando. Repos já publicados precisam copiar o template de `cd.yml` de novo para o dispatch aceitar `deploy-type`, `custom-domain` e `project-name`. Sem isso, o Studio ainda dispara o deploy (fallback sem inputs) e o domínio sincroniza pelo botão **Sincronizar domínio**.

## Pipeline no repo do cliente

Copie [`_templates/cd.yml`](_templates/cd.yml) para `.github/workflows/cd.yml` no repositório do cliente. Ajuste o default de `deploy-type` (`cloudflare` ou `vercel`), `framework` (`next` ou `vite`) e `project-name`.

O job chama [reusable-client-website.yml](../.github/workflows/reusable-client-website.yml) no `namaocriativa/namao-criativa`. Sites Next precisam de `output: 'export'` (o CD publica `out/`; Vite publica `dist/`). O workflow cria o projeto Pages se ainda não existir. Depois do `pages deploy`, se `custom-domain` vier preenchido, o workflow anexa apex + `www`.

Conta pessoal (sem org): as keys do `namao-criativa` **não** passam para os outros repos. Em cada site, `Settings → Secrets and variables → Actions`:

| Nome | Tipo |
|------|------|
| `CLOUDFLARE_API_TOKEN` | Secret (mesmo token do Namao) |
| `CLOUDFLARE_ACCOUNT_ID` | Variable (mesmo account id) |

Token da API (PAT com `repo` + `workflow`): `GITHUB_WEBSITES_TOKEN` no `.env` da platform e em `cloud/.env` (Coolify). Para o botão de sincronizar domínio: `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` na API (Pages Edit + Zone Read + DNS Edit).
