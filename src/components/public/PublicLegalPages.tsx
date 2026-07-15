import React from 'react';
import { Database, FileText, Lock, Mail, ShieldCheck, Users } from 'lucide-react';

const lastUpdated = '20 de junho de 2026';
const contactEmail = 'contato@gestifique.com.br';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
    <div className="space-y-3 text-sm font-medium leading-relaxed text-slate-600">{children}</div>
  </section>
);

const BulletList = ({ items }: { items: string[] }) => (
  <ul className="space-y-2 pl-5 list-disc">
    {items.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
);

const LegalHero = ({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ElementType;
}) => (
  <section className="pt-20 pb-12 px-6 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700">
        <Icon size={14} />
        {eyebrow}
      </div>
      <div className="space-y-4">
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="max-w-3xl text-base lg:text-lg font-medium leading-relaxed text-slate-500">
          {description}
        </p>
        <p className="text-xs font-semibold text-slate-400">Ultima atualizacao: {lastUpdated}</p>
      </div>
    </div>
  </section>
);

export const PublicPrivacyPolicyPage = () => {
  return (
    <div className="flex flex-col bg-white">
      <LegalHero
        eyebrow="Privacidade e dados"
        title="Politica de Privacidade"
        description="Esta Politica descreve como o Gestifique coleta, usa, armazena, protege, compartilha e exclui dados tratados na plataforma, incluindo dados recebidos por canais de e-mail."
        icon={ShieldCheck}
      />

      <main className="px-6 py-12 bg-white">
        <div className="max-w-4xl mx-auto grid gap-10">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: Lock, title: 'Acesso restrito', text: 'Controles por perfil, autenticacao e registros de auditoria.' },
              { icon: Database, title: 'Finalidade limitada', text: 'Dados usados para atendimento, tickets, SLA e suporte.' },
              { icon: Mail, title: 'Canal de privacidade', text: contactEmail },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <item.icon size={18} className="mb-3 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{item.text}</p>
              </div>
            ))}
          </div>

          <Section title="1. Controlador e escopo desta Politica">
            <p>
              O Gestifique e uma plataforma SaaS de gestao de atendimento, tickets, SLA, portal do cliente,
              base de conhecimento, relatorios, automacoes e canais de e-mail. Esta Politica se aplica ao site
              publico, ao painel administrativo, ao portal do cliente, as APIs e aos canais de e-mail da plataforma.
            </p>
            <p>
              A empresa contratante e responsavel pela base de dados operacional inserida por seus usuarios,
              clientes e representantes. O Gestifique trata esses dados para executar a plataforma, manter a
              seguranca, prestar suporte e cumprir obrigacoes legais e contratuais.
            </p>
          </Section>

          <Section title="2. Dados coletados e tratados">
            <BulletList
              items={[
                'Dados de identificacao e acesso: nome, e-mail, telefone, cargo, empresa, perfil, permissoes, status da conta e registros de autenticacao.',
                'Dados corporativos: nome da empresa, CNPJ, dominio, contatos de suporte, configuracoes de canais, identidade visual e preferencias operacionais.',
                'Dados de atendimento: tickets, mensagens, comentarios internos, anexos, categorias, prioridades, filas, responsaveis, SLA, eventos, historico de alteracoes e satisfacao do cliente.',
                'Dados tecnicos e de seguranca: IP, user agent, data e hora de acesso, logs de erro, logs de auditoria, tentativas de autenticacao e informacoes necessarias para prevencao de abuso.',
                'Dados de e-mail: endereco publico do canal, endereco tecnico de encaminhamento, remetente, destinatarios, assunto, corpo, anexos, cabecalhos de conversa e identificadores de mensagens.',
              ]}
            />
          </Section>

          <Section title="3. Finalidades de uso">
            <BulletList
              items={[
                'Criar, organizar, classificar, distribuir, acompanhar e encerrar tickets de atendimento.',
                'Vincular mensagens recebidas por e-mail a tickets novos ou existentes, evitando duplicidade por Message-ID, In-Reply-To, References e outros metadados de conversa.',
                'Permitir que usuarios autorizados respondam tickets e acompanhem o historico de atendimento.',
                'Controlar SLA, prioridades, responsaveis, filas, auditoria, relatorios e indicadores operacionais.',
                'Enviar mensagens transacionais, respostas de tickets, notificacoes e e-mails necessarios a operacao.',
                'Manter seguranca, diagnosticar falhas, prevenir spam, abuso, fraude, acesso indevido e uso incompatavel com estes documentos.',
              ]}
            />
          </Section>

          <Section title="4. Canais de e-mail">
            <p>
              A empresa pode cadastrar enderecos publicos de atendimento e configurar regras de encaminhamento
              no seu proprio provedor de e-mail para que mensagens recebidas sejam processadas pelo Gestifique.
              O envio de respostas e mensagens transacionais usa a configuracao SMTP da plataforma.
            </p>
            <p>
              O Gestifique usa os dados de e-mail apenas para criar, atualizar e preservar o historico dos tickets,
              entregar respostas aos destinatarios corretos e manter rastreabilidade operacional. Nao vendemos dados
              de e-mail e nao os usamos para publicidade ou perfilamento comercial.
            </p>
          </Section>

          <Section title="5. Credenciais e seguranca de integracoes">
            <p>
              Credenciais tecnicas e segredos operacionais, quando necessarios, sao armazenados com controles de
              acesso restritos. O acesso a esses dados fica limitado a processos necessarios para executar a plataforma,
              autenticar servicos internos, enviar mensagens, receber mensagens encaminhadas e registrar eventos.
            </p>
            <p>
              A empresa continua responsavel por manter suas contas de e-mail, DNS, usuarios, senhas e regras de
              encaminhamento sob controle adequado.
            </p>
          </Section>

          <Section title="6. Compartilhamento e subprocessadores">
            <p>
              Nao vendemos dados pessoais ou dados de e-mail. Podemos compartilhar dados somente com fornecedores
              necessarios a execucao da plataforma, como hospedagem, banco de dados, armazenamento de arquivos,
              envio de e-mails, monitoramento e suporte tecnico.
            </p>
            <p>
              Tambem poderemos divulgar dados quando necessario para cumprir lei, ordem de autoridade competente,
              defesa de direitos, investigacao de incidentes, prevencao de abuso ou protecao da seguranca da plataforma.
            </p>
          </Section>

          <Section title="7. Retencao, exclusao e minimizacao">
            <p>
              Mantemos dados pelo tempo necessario para prestar o servico, preservar historico de atendimento,
              cumprir obrigacoes legais ou contratuais, resolver disputas, manter logs de auditoria e proteger a
              seguranca da plataforma.
            </p>
            <p>
              Mediante solicitacao valida, avaliaremos exclusao, anonimizacao, bloqueio ou exportacao de dados,
              respeitando obrigacoes legais, antifraude, auditoria, seguranca e continuidade da relacao contratual.
            </p>
          </Section>

          <Section title="8. Direitos dos titulares e canal de solicitacao">
            <p>
              Conforme a legislacao aplicavel, titulares podem solicitar confirmacao de tratamento, acesso, correcao,
              anonimizacao, portabilidade, bloqueio, eliminacao, informacao sobre compartilhamento e revisao de decisoes
              automatizadas, quando aplicavel. Solicitacoes devem ser enviadas para <strong>{contactEmail}</strong>.
            </p>
          </Section>

          <Section title="9. Uso proibido dos dados">
            <p>
              Dados tratados pelo Gestifique nao podem ser usados por clientes ou usuarios para spam, assedio, fraude,
              discriminacao, scraping, venda de listas, envio de conteudo ilegal, violacao de direitos de terceiros
              ou qualquer finalidade incompatavel com atendimento e suporte legitimos.
            </p>
          </Section>

          <Section title="10. Alteracoes nesta Politica">
            <p>
              Podemos atualizar esta Politica para refletir mudancas legais, tecnicas, operacionais ou de integracoes.
              A versao vigente ficara disponivel nesta pagina, com data de atualizacao.
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
};

export const PublicTermsOfUsePage = () => {
  return (
    <div className="flex flex-col bg-white">
      <LegalHero
        eyebrow="Termos contratuais"
        title="Termos de Uso"
        description="Estes Termos definem regras para acesso, uso, responsabilidades, limitacoes e integracoes do Gestifique por empresas, usuarios internos e clientes finais autorizados."
        icon={FileText}
      />

      <main className="px-6 py-12 bg-white">
        <div className="max-w-4xl mx-auto grid gap-10">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
            <div className="flex items-start gap-3">
              <Users size={20} className="mt-0.5 shrink-0 text-blue-700" />
              <p className="text-sm font-semibold leading-relaxed text-blue-900">
                Ao acessar ou usar o Gestifique, voce confirma que leu, compreendeu e aceita estes Termos.
                Se estiver atuando em nome de uma empresa, declara possuir autorizacao para vincula-la a estes Termos.
              </p>
            </div>
          </div>

          <Section title="1. Objeto e natureza do servico">
            <p>
              O Gestifique e uma plataforma SaaS para gestao de atendimento, tickets, SLA, portal do cliente,
              usuarios, permissoes, relatorios, base de conhecimento, anexos, automacoes e canais de e-mail.
            </p>
          </Section>

          <Section title="2. Elegibilidade, contas e permissoes">
            <BulletList
              items={[
                'A empresa e responsavel por autorizar usuarios, definir perfis, revisar permissoes e remover acessos indevidos ou desnecessarios.',
                'Cada usuario deve usar credenciais proprias, manter senha em sigilo e comunicar qualquer suspeita de acesso nao autorizado.',
                'Administradores respondem por acoes realizadas por usuarios que tenham recebido permissoes dentro da conta da empresa.',
                'E proibido compartilhar credenciais, burlar autenticacao, explorar falhas, testar invasao sem autorizacao ou acessar dados de terceiros sem permissao.',
              ]}
            />
          </Section>

          <Section title="3. Responsabilidade pelo conteudo">
            <p>
              A empresa e seus usuarios sao responsaveis por dados, mensagens, anexos, informacoes de clientes,
              bases de conhecimento e demais conteudos inseridos, importados, encaminhados ou transmitidos pela
              plataforma.
            </p>
          </Section>

          <Section title="4. Uso permitido e condutas proibidas">
            <p>
              O Gestifique deve ser usado exclusivamente para atendimento, suporte, gestao operacional e comunicacao
              legitima com clientes ou usuarios autorizados. E proibido usar a plataforma para spam, phishing, malware,
              coleta indevida de dados, venda de listas, assedio, fraude ou envio de conteudo ilicito.
            </p>
          </Section>

          <Section title="5. Integracoes de e-mail">
            <p>
              A empresa pode cadastrar canais de e-mail e configurar encaminhamento no seu proprio provedor. A empresa
              declara que possui direito e autorizacao para usar esses enderecos como canais de atendimento e que
              informara seus usuarios e clientes sobre o tratamento de mensagens relacionado a tickets.
            </p>
            <p>
              Provedores de e-mail, DNS, hospedagem e demais servicos externos podem impor limites, verificacoes,
              suspensoes, mudancas de politica ou indisponibilidades que estejam fora do controle do Gestifique.
            </p>
          </Section>

          <Section title="6. Obrigacoes da empresa sobre e-mail e dados de clientes">
            <BulletList
              items={[
                'Obter autorizacoes internas necessarias antes de usar caixas de e-mail corporativas ou pessoais para atendimento.',
                'Nao encaminhar mensagens sem relacao com a operacao de suporte, salvo se houver base legal e autorizacao adequadas.',
                'Nao usar o Gestifique para monitoramento secreto, vigilancia indevida ou tratamento incompatavel com leis de privacidade e trabalho.',
                'Manter informacoes de clientes corretas e remover dados desnecessarios, excessivos ou inseridos por engano.',
              ]}
            />
          </Section>

          <Section title="7. Seguranca e resposta a incidentes">
            <p>
              Empregamos medidas razoaveis de seguranca tecnica e administrativa, mas nenhum sistema e imune a riscos.
              A empresa deve manter dispositivos, senhas, DNS, provedores de e-mail e usuarios sob controle adequado.
              Incidentes ou acessos nao autorizados devem ser comunicados imediatamente pelo e-mail{' '}
              <strong>{contactEmail}</strong>.
            </p>
          </Section>

          <Section title="8. Funcionalidades beta e mudancas no produto">
            <p>
              Recursos identificados como beta, teste, experimental ou pre-lancamento podem apresentar instabilidade,
              limitacoes, mudancas de comportamento, suspensao ou remocao sem aviso previo.
            </p>
          </Section>

          <Section title="9. Planos, cobranca, suspensao e cancelamento">
            <p>
              Condicoes comerciais, precos, limites, cobranca, suporte, vigencia e cancelamento podem ser definidos
              em proposta, contrato ou pagina de planos vigente.
            </p>
          </Section>

          <Section title="10. Propriedade intelectual">
            <p>
              O Gestifique, incluindo marca, software, codigo, design, textos, fluxos, documentacao, interfaces,
              relatorios e recursos, pertence aos seus titulares.
            </p>
          </Section>

          <Section title="11. Disponibilidade e limitacoes de responsabilidade">
            <p>
              Buscamos manter a plataforma disponivel, segura e funcional, mas nao garantimos operacao ininterrupta
              ou livre de falhas. Na maxima extensao permitida por lei, nao respondemos por falhas de terceiros,
              indisponibilidade de APIs externas, erros de configuracao da empresa ou dados inseridos incorretamente.
            </p>
          </Section>

          <Section title="12. Privacidade e protecao de dados">
            <p>
              O tratamento de dados pessoais e dados de e-mail e regulado pela Politica de Privacidade do Gestifique,
              que integra estes Termos.
            </p>
          </Section>

          <Section title="13. Alteracoes dos Termos">
            <p>
              Podemos atualizar estes Termos para refletir mudancas legais, tecnicas, operacionais, comerciais ou de
              seguranca. O uso continuado da plataforma apos a publicacao da nova versao indica aceitacao dos Termos.
            </p>
          </Section>

          <Section title="14. Contato">
            <p>
              Duvidas sobre estes Termos, privacidade, seguranca, contratos ou uso da plataforma devem ser enviadas
              para <strong>{contactEmail}</strong>.
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
};
