# Modelo de acesso do módulo de Obrigações

## Regra vigente

Obrigações, planilhas e municípios não pertencem a um usuário. Toda operação exige autenticação e a permissão específica do módulo. A autoria registrada em criação, edição, comentário, anexo ou histórico é informação de auditoria e não limita o acesso ao registro.

As permissões aplicadas pelas rotas são:

- `obrigacoes.dashboard.visualizar`
- `obrigacoes.municipios.visualizar`
- `obrigacoes.municipios.criar`
- `obrigacoes.municipios.editar`
- `obrigacoes.municipios.excluir`
- `obrigacoes.planilha.visualizar`
- `obrigacoes.planilha.editar`
- `obrigacoes.planilha.comentar`
- `obrigacoes.planilha.anexar`
- `obrigacoes.planilha.editar_historico`

O módulo não possui escopo próprio de empresa ou unidade no esquema atual. Se esse escopo for introduzido, ele deverá ser aplicado em todas as consultas além das permissões acima.

## Dados legados e auditoria

A migração `048_obligations_remove_fixed_responsibility` arquiva a configuração histórica por município antes de remover a coluna operacional. O arquivo serve somente para rastreabilidade ou reversão; ele não participa de filtros, acesso, indicadores ou notificações.

Municípios e obrigações registram criador, último editor e versão. Alterações de tarefas continuam no histórico existente. Alterações e desativações de municípios são registradas em `obligation_municipality_history` com autor, horário e valores anterior e posterior.

## Concorrência

Edições de municípios, obrigações e correções de histórico enviam a versão lida pelo cliente. Se outro usuário salvar primeiro, a API responde com conflito HTTP 409 e exige recarregar os dados. Isso impede sobrescrita silenciosa.

## Notificações

Não existe atualmente um fluxo de notificações específico de Obrigações nem um cadastro de seguidores, grupos por município ou preferências desse módulo. Nenhuma difusão geral foi criada. Uma futura implementação deve usar inscrição explícita ou grupos de interesse e validar a permissão do destinatário no momento do envio.
