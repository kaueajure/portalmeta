# Deploy na Hostinger

Este guia descreve como fazer o deploy da Gestifique (Frontend + Backend) em um ambiente Node.js na Hostinger.

O projeto foi preparado para gerar a **build de produção** de maneira ideal, onde:
- O frontend é compilado para HTML/CSS/JS estático.
- O backend (TypeScript) é compilado para JavaScript (ESM).
- O backend serve as rotas da API e os arquivos estáticos do frontend.

---

## 1. Configurando o Banco de Dados (MySQL)

1. No painel da Hostinger, vá em **Bancos de Dados -> Bancos de dados MySQL**.
2. Crie um novo banco de dados (ex: `u237752053_gestifique`), informando usuário e senha fortes.
3. Se você for rodar ou acessar localmente para popular dados, certifique-se de liberar o seu IP em **MySQL Remoto**.
4. Anote:
   - Host (geralmente algo como `srv1883.hstgr.io` ou `localhost` se a aplicação Node.js estiver no mesmo servidor)
   - Nome do Banco de Dados
   - Nome de Usuário
   - Senha

## 2. Configurando o Ambiente Node.js

1. No painel da Hostinger, vá na sua configuração de Hospedagem e procure por configurações do Node.js ou crie um novo aplicativo web com o "Framework Preset" como `Other` ou `Express`.
2. Configure a aplicação da seguinte forma:
   - **Package Manager:** `npm`
   - **Build command:** `npm run build`
   - **Start command:** `npm run start`
   - **Entry file (Arquivo de Inicialização):** `dist-server/server.js`

## 3. Variáveis de Ambiente

Na opção de adicionar variáveis de ambiente no painel Node.js da Hostinger, adicione as seguintes **variáveis obrigatórias**. O arquivo `.env` **NÃO DEVE SER ENVIADO PARA O GITHUB**.

| Variável | Valor Exemplo |
|---|---|
| `NODE_ENV` | `production` (CRÍTICO para segurança) |
| `PORT` | `3000` (ou a porta fornecida pelo painel da Hostinger) |
| `JWT_SECRET` | `UmaChaveMuitoLongaeSegura123456` |
| `DB_HOST` | `srv1883.hstgr.io` (Pode ser localhost se BD na mesma conta) |
| `DB_USER` | `u237752053_gestifique` |
| `DB_PASSWORD` | `SuaSenhaDoBanco!` |
| `DB_NAME` | `u237752053_gestifique` |
| `DB_PORT` | `3306` |
| `DEV_EMAIL` | `admin@gestifique.com.br` |
| `DEV_PASSWORD` | `SenhaForte123@#` |
| `AUTO_RUN_MIGRATIONS` | `false` |

Em produção, rode `npm run db:migrate` manualmente antes do start. Evite migrations automáticas no boot.

## 4. O Fluxo de Build

Ao clicar em compilar ou realizar o deploy pela Hostinger, o sistema executará os passos:
1. `npm install`: Baixa todas as dependências do projeto.
2. `npm run build`: Vai gerar o Frontend para a pasta `/dist` e o Backend compilado para a pasta `/dist-server`.
3. `npm run db:migrate`: Aplica as migrations pendentes com controle.
4. `npm run start`: Vai invocar `node dist-server/server.js`, que no modo `production` servirá com segurança tanto as APIs backend quanto arquivos na pasta `dist`.

## Dicas Adicionais
- Use a opção 'Stop app' e 'Start app' dentro do cPanel da Hostinger caso sinta que a versão alterada não foi atualizada no painel.
- Para verificar logs de erro, na aplicação Node existe um local onde você encontra as saídas do Terminal.
- Certifique-se que o arquivo `.env` está inserido apenas no `.gitignore` quando trabalhar com repositórios e branches.
