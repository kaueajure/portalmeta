# Checklist de deploy na Hostinger Web Business

Este checklist assume hospedagem Web Business com Node.js, Express, React/Vite, MySQL/MariaDB e filesystem local.

## Variaveis obrigatorias

Configure o `.env` no servidor:

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=gere_uma_chave_forte_com_mais_de_32_caracteres
APP_TIMEZONE=America/Sao_Paulo

DB_HOST=localhost
DB_USER=usuario_mysql
DB_PASSWORD=senha_mysql
DB_NAME=nome_do_banco
DB_PORT=3306

AUTO_RUN_MIGRATIONS=false

INTERNAL_JOB_TOKEN=gere_um_token_forte
ALLOW_INTERNAL_JOB_TOKEN_IN_QUERY=false

ENABLE_WEB_SERVER=true
ENABLE_TICKET_JOBS=true
ENABLE_EMAIL_LISTENER=false

STORAGE_TYPE=local
UPLOAD_DIR=uploads/tickets
```

Se usar SMTP por canal, configure tambem `ENCRYPTION_KEY` e os canais no painel.

Gere os segredos em uma maquina confiavel:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))" # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" # INTERNAL_JOB_TOKEN
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" # ENCRYPTION_KEY
```

Nao reutilize esses valores entre ambientes.

## Comandos de deploy

```bash
npm ci
npm run build
npm run db:migrate
npm start
```

Em producao, mantenha `AUTO_RUN_MIGRATIONS=false` e rode `npm run db:migrate` de forma controlada antes do start.

## Job da outbox

Preferencialmente deixe:

```env
ENABLE_TICKET_JOBS=true
```

Isso processa a outbox no proprio processo Node com lock MySQL.

Como alternativa, configure cron chamando:

```bash
POST https://seu-dominio.com/api/internal/jobs/process-email-outbox
Header: x-internal-job-token: SEU_INTERNAL_JOB_TOKEN
```

Se a Hostinger nao permitir header customizado no cron, habilite:

```env
ALLOW_INTERNAL_JOB_TOKEN_IN_QUERY=true
```

E use:

```text
https://seu-dominio.com/api/internal/jobs/process-email-outbox?token=SEU_INTERNAL_JOB_TOKEN
```

A query string pode aparecer em logs e historico; use apenas quando header nao for viavel.

## Testes manuais apos deploy

1. Login de atendente/admin.
2. Criar chamado pelo painel.
3. Confirmar item em `email_outbox` ou em `/api/internal/outbox/summary`.
4. Responder publicamente e confirmar novo item na outbox.
5. Enviar nota interna e confirmar que nao gera e-mail externo.
6. Finalizar/fechar chamado e confirmar e-mail final na outbox.
7. Rodar o job interno e confirmar mudanca para `enviado`.
8. Acessar portal do cliente, criar chamado e responder.
9. Enviar anexo publico e interno.
10. Soft delete de chamado: confirmar que sumiu do portal, dashboard e relatorios comuns.
11. Abrir link CSAT e responder pesquisa.

## Diagnostico da outbox

Rotas autenticadas para desenvolvedor/admin:

```text
GET  /api/internal/outbox/summary
GET  /api/internal/outbox/errors
POST /api/internal/outbox/:id/retry
POST /api/internal/outbox/retry-errors
```

Essas rotas nao expõem `payload_json` completo.

## Nao usar como requisito

- Redis obrigatorio.
- Docker.
- S3 obrigatorio.
- VPS.
- RabbitMQ, BullMQ ou fila externa.
- PM2 avancado.

## Cuidados operacionais

- Fazer backup do banco antes de migrations.
- Fazer backup de `UPLOAD_DIR`.
- Usar `INTERNAL_JOB_TOKEN` forte.
- Manter `JWT_SECRET` forte e unico.
- Revisar logs de `email_outbox` apos alteracoes de SMTP.
