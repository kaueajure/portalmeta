# Gestifique3 - Migrações de Banco de Dados

O projeto utiliza um sistema de migrações versionadas para garantir que a estrutura do banco de dados (MySQL) esteja sempre atualizada e consistente entre os ambientes de desenvolvimento e produção.

## Estrutura

- `server/db/migrations/`: Contém os arquivos de migração (`.ts`). Cada arquivo segue o padrão `NOME_DA_MIGRACAO.ts`.
- `server/db/migration-runner.ts`: Motor que executa as migrações pendentes.
- `server/db/migrate.ts`: Script CLI para execução manual.

## Como funciona

O sistema usa `schema_migrations` para registrar as migrações executadas e `migration_lock` para evitar execuções paralelas.

Em desenvolvimento, se `AUTO_RUN_MIGRATIONS` não for definido, o boot pode executar migrations automaticamente.

Em produção, use `AUTO_RUN_MIGRATIONS=false` e rode migrations manualmente como etapa controlada de deploy. Isso evita `ALTER TABLE`, criação de índices e outros DDLs durante o boot da aplicação.

Fluxo do runner:
1. Verifica/cria as tabelas de controle.
2. Lê os arquivos em `server/db/migrations/`.
3. Executa apenas arquivos ausentes em `schema_migrations`.
4. Usa `migration_lock` para evitar execução simultânea.

## Comandos

### Executar migrações manualmente
```bash
npm run db:migrate
```

### Produção
```bash
npm run build
npm run db:migrate
npm start
```

Antes de rodar migrations em produção, faça backup do banco.

## Criando uma nova migração

Para criar uma nova migração, adicione um arquivo em `server/db/migrations/` (ex: `003_add_feature_x.ts`):

```typescript
import { PoolConnection } from 'mysql2/promise';

export async function up(connection: PoolConnection) {
  // Sua lógica de SQL aqui
  await connection.query('ALTER TABLE table_name ADD COLUMN column_name VARCHAR(255)');
}
```

**Importante:** Cada migração é executada dentro de uma transação. Se houver erro, ela sofrerá rollback automático. No entanto, lembre-se que comandos DDL (como CREATE TABLE, ALTER TABLE) fazem commit implícito no MySQL, então tente ser o mais idempotente possível ou divida migrações grandes.

## Tabelas de Controle

- `schema_migrations`: Armazena o histórico de migrações executadas.
- `migration_lock`: Garante exclusividade de execução.
