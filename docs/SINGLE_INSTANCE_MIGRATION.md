# Migração para instância única

O Portal Meta opera exclusivamente para a MetaBit. A identidade institucional fica em
`application_settings` (registro singleton `id = 1`) e não é usada como chave de escopo.

## Diagnóstico e preservação

Antes da contração do esquema, o banco possuía somente a empresa MetaBit (`id = 1`).
Todas as tabelas segmentadas foram verificadas e não havia registros associados a outro
identificador. As contagens registradas antes da alteração foram preservadas.

## Alterações aplicadas

- Remoção das colunas `empresa_id`, `company_id` e `tenant_id`, incluindo índices e
  chaves estrangeiras relacionadas.
- Remoção da tabela `empresas` e das rotas de cadastro, edição, exclusão e seleção.
- Conversão das configurações de chamados, SLA, canais e distribuição para recursos
  globais da instância.
- Renomeação das tabelas operacionais:
  - `empresa_email_canais` → `email_channels`
  - `empresa_ticket_categorias` → `ticket_categories`
  - `empresa_ticket_servicos` → `ticket_services`
  - `empresa_ticket_status` → `ticket_statuses`
  - `empresa_sla_politicas` → `sla_policies`
  - `empresa_distribuicao_regras` → `distribution_rules`
- Autenticação, cargos, perfis de acesso e permissões continuam vinculados diretamente
  aos usuários.

## Segurança da migration

A migration `037_single_company_contract.ts` interrompe a execução se encontrar outra
empresa ou qualquer registro fora do antigo escopo `id = 1`. Ela não exclui tickets,
usuários, clientes, logs, configurações, permissões, relatórios ou integrações.

As migrations anteriores mantêm referências ao modelo antigo por serem o histórico
necessário para criar e atualizar bancos instalados em versões anteriores.

O runner normaliza a identidade dos arquivos `.ts` (desenvolvimento) e `.js`
(build de produção), impedindo que o mesmo histórico seja executado duas vezes. A
migration `038_remove_recreated_legacy_tables.ts` é um reparo defensivo: ela somente
remove tabelas legadas se estiverem vazias e interrompe a execução caso encontre
qualquer registro.
