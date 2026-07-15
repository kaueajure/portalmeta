# Gestifique3 - SaaS de Gestão de Tickets

Sistema profissional de atendimento ao cliente com suporte Omnichannel, SLA, Portal do Cliente e Base de Conhecimento.

## 🚀 Guia de Deploy para Hostinger (Business Web Hosting)

### 1. Preparação do Ambiente
- Certifique-se de que o Node.js v18+ está instalado.
- Crie um banco de dados MySQL/MariaDB.
- Configure o arquivo `.env` baseado no `.env.example`.

### 2. Configurações Críticas para Hostinger
Para que a aplicação funcione corretamente atrás do proxy da Hostinger e com segurança:
```env
TRUST_PROXY=1              # Permite que o Rate Limit identifique o IP real do cliente
ENABLE_WEB_SERVER=true
ENABLE_TICKET_JOBS=true
ENABLE_EMAIL_LISTENER=false # Só ative após configurar IMAP real e testado
```

### 3. Build e Migrations
Execute os seguintes comandos no servidor:
```bash
npm install
npm run build
npm run db:migrate # Aplica todas as tabelas e correções estruturais (idempotente)
```

Para o checklist completo de producao, rollback, workers e healthcheck, veja `docs/PRODUCTION_RUNBOOK.md`.

### 4. Execução
Utilize `pm2` ou similar para manter o processo rodando:
```bash
pm2 start dist-server/server.js --name gestifique
```

## 🛠️ Modos de Escala (Workload Separation)

O Gestifique3 permite separar a carga de trabalho em diferentes processos (WEB vs WORKER):

- **Modo Monolítico (Padrão)**: `node dist-server/server.js` (Roda tudo: API + Jobs + Email Listener).
- **Modo Worker-Only**: `node dist-server/worker.js` (Focado apenas em background processing. Desabilita rotas e frontend para economizar recursos).

## 🛡️ Segurança e Armazenamento

- **Storage**: O sistema utiliza o `StorageService` para abstrair uploads. Configure `UPLOAD_DIR` no `.env` para o caminho onde deseja salvar anexos.
- **Segurança**: Helmet.js configurado com CSP rígida. Certifique-se de incluir seus domínios reais em `CORS_ORIGINS`.
- **Rate Limit**: Proteção contra ataques de força bruta ativa por padrão. Requer `TRUST_PROXY` configurado corretamente em produção.

---
Desenvolvido com foco em performance e escala para times de suporte modernos.
