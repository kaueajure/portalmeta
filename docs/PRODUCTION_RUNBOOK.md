# Gestifique - Runbook de Producao

Este runbook resume o fluxo seguro para subir o sistema de tickets em producao.

## Checklist Antes do Deploy

- Revisar `.env` real e nunca versionar segredos.
- Gerar `JWT_SECRET` forte com pelo menos 32 caracteres aleatorios.
- Configurar `NODE_ENV=production`.
- Configurar MySQL: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`.
- Definir `AUTO_RUN_MIGRATIONS=false` em producao.
- Configurar `CORS_ORIGINS` apenas com dominios reais.
- Configurar `TRUST_PROXY=1` quando houver proxy reverso, Nginx, Cloudflare ou Hostinger.
- Usar HTTPS no dominio publico.
- Configurar storage de anexos: `STORAGE_TYPE=local` e `UPLOAD_DIR` persistente.
- Configurar `ENCRYPTION_KEY` forte antes de usar SMTP por canal.
- Manter `MAIL_TLS_INSECURE=false` em producao.
- Definir papeis dos processos:
  - Web: `ENABLE_WEB_SERVER=true`, `ENABLE_TICKET_JOBS=false`, `ENABLE_EMAIL_LISTENER=false`.
  - Worker unico: `ENABLE_WEB_SERVER=false`, `ENABLE_TICKET_JOBS=true`, `ENABLE_EMAIL_LISTENER=true`.
- Fazer backup do banco antes de migrations.
- Rodar `npm run lint`, `npm test` e `npm run build`.

## Variaveis Obrigatorias

- `NODE_ENV`
- `PORT`
- `JWT_SECRET`
- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_PORT`

## Variaveis Recomendadas em Producao

- `AUTO_RUN_MIGRATIONS=false`
- `CORS_ORIGINS=https://seu-dominio.com.br,https://app.seu-dominio.com.br`
- `TRUST_PROXY=1`
- `DB_CONNECTION_LIMIT=10`
- `DB_QUEUE_LIMIT=100`
- `DB_CONNECT_TIMEOUT_MS=10000`
- `STORAGE_TYPE=local`
- `UPLOAD_DIR=/caminho/persistente/uploads/tickets`
- `ENCRYPTION_KEY=<segredo forte>`
- `ALLOW_GLOBAL_TICKET_EMAIL_FALLBACK=false`
- `MAIL_TLS_INSECURE=false`

## Deploy Seguro

1. Atualizar codigo no servidor.
2. Instalar dependencias:

```bash
npm ci
```

3. Validar codigo:

```bash
npm run lint
npm test
npm run build
```

4. Fazer backup do MySQL.
5. Rodar migrations manualmente:

```bash
npm run db:migrate
```

6. Subir processo web:

```bash
npm start
```

7. Subir worker unico quando necessario:

```bash
npm run start:worker
```

8. Verificar healthcheck:

```bash
curl https://seu-dominio.com.br/health
curl https://seu-dominio.com.br/ready
```

## Migrations

O boot nao deve executar DDL automaticamente em producao. Use:

```bash
npm run db:migrate
```

Ordem segura:

1. Backup do banco.
2. Parar workers de e-mail/jobs.
3. Rodar migrations.
4. Conferir logs `[MIGRATE]`.
5. Subir web.
6. Subir worker.

Se uma migration falhar:

- Nao reinicie em loop.
- Verifique qual arquivo falhou no log.
- Restaure backup se houve DDL parcial ou indice unico criado parcialmente.
- Corrija dados duplicados antes de tentar novamente indices unicos.

## Workers e Jobs

- `npm start` roda `dist-server/server.js`.
- `npm run start:worker` roda `dist-server/worker.js`.
- O worker define `ENABLE_WEB_SERVER=false` quando a variavel nao foi informada.
- Automacoes usam lock MySQL `GET_LOCK`, evitando execucao simultanea do job.
- O listener de e-mail deve rodar em apenas um worker por ambiente.
- Em multi-instancia, nao deixe `ENABLE_EMAIL_LISTENER=true` em mais de um processo.

## Observabilidade Basica

- `GET /health`: liveness simples da API.
- `GET /ready`: readiness publico com API e MySQL, sem expor segredos.
- `GET /api/health/overview`: diagnostico interno, exige usuario desenvolvedor.
- Monitorar logs de:
  - `[MIGRATE]`
  - `[BOOT]`
  - `[JOB ERROR]`
  - `[Automations]`
  - `[EmailListener]`
  - `[SECURITY]`

## Backup e Rollback

- Fazer dump MySQL antes de migrations.
- Guardar build anterior ou tag Git do deploy.
- Para rollback de codigo: voltar para artefato/commit anterior e reiniciar processos.
- Para rollback de banco: preferir restore do backup quando houve DDL ou indice unico.
- Antes de recriar indices unicos, corrigir duplicidades manualmente em ambiente controlado.

## Teste Manual Antes de Liberar Clientes

- Login como desenvolvedor.
- Login como administrador de empresa.
- Login como atendente.
- Login como cliente no portal.
- Admin da empresa A nao acessa ticket da empresa B.
- Admin da empresa A nao lista empresas de outros tenants.
- Listagem de tickets com filtros combinados, busca, ordenacao e paginacao.
- Abertura de ticket com muitas mensagens e anexos.
- Mensagem interna nao aparece no portal.
- Anexo interno nao aparece no portal.
- Inbound de e-mail nao responde ticket de outra empresa via `[Ticket #ID]`.
- Mesmo `Message-ID` chegando em empresas diferentes nao deduplica globalmente.
- Acoes em massa respeitam empresa e permissoes.
- Kanban bloqueia movimentos sem permissao.
- Dashboard mostra apenas dados da empresa.
- Worker processa automacoes sem duplicar execucao.
- `/health` retorna 200.
- `/ready` retorna 200 com banco disponivel.

## Pontos Para Monitorar

- Crescimento das tabelas `tickets`, `ticket_mensagens`, `ticket_anexos`, `processed_emails`.
- Tempo de resposta de listagem de tickets.
- Falhas SMTP/IMAP por canal.
- Erros de permissionamento 403 inesperados.
- Tamanho do bundle frontend e necessidade futura de code splitting.
- Uso de disco em `UPLOAD_DIR`.
