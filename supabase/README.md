# Reservas de áreas

## Ativar no Supabase

No SQL Editor do projeto, execute as migrações em ordem, uma única vez cada:

1. `migrations/202611040001_area_reservations.sql` (criação da tabela; pule se já aplicada).
2. `migrations/202611040002_reservation_deadline.sql` (validade de cinco dias e confirmação de contato).

Criar esses arquivos locais não altera o banco remoto. Depois de aplicar, faça login no site, escolha uma região/parcela e solicite a reserva. Confira protocolo e vencimento em Minhas reservas e recarregue para testar persistência.

## Prazo e disponibilidade

O banco define a criação e o vencimento: cinco dias corridos, exatamente 120 horas, inclusive para reservas já existentes (a partir da criação original). A interface mostra data e hora de Brasília. O cliente não pode escolher ou prorrogar o prazo.

A view `area_reservation_details` calcula o status expirado com o relógio do banco. Mesmo sem navegador aberto, uma reserva vencida deixa de valer. Antes de uma nova inserção, um trigger marca as pendências vencidas daquela parcela como expiradas, sob um lock de transação; o índice único permite apenas uma reserva ativa. Isso libera a parcela na primeira nova solicitação, sem depender de cron ou da limpeza periódica de registros. O histórico é preservado. A coluna bruta `status` pode continuar como `pending_contact` até a próxima solicitação da parcela; consulte a view para obter o status efetivo.

## Confirmação pela equipe

Execute `migrations/202611050001_reservation_contact.sql` no SQL Editor uma única vez, depois das migrações de reservas, perfis e listagem administrativa já aplicadas. Não reexecute as migrações anteriores.

Colaboradores e administradores acessam `/atendimento` pelo link Atendimento na página inicial. A tela permite buscar por e-mail/protocolo, filtrar por situação e confirmar um contato com observação interna opcional de até 2000 caracteres. O login continua abrindo primeiro a página inicial.

A função `team_list_reservations` valida o perfil no banco antes de consultar reservas e e-mails. A função `confirm_reservation_contact` valida a equipe, usa o mesmo lock por parcela da criação de reservas, bloqueia vencimentos pelo relógio do banco e grava status, autor, data e nota numa única transação. Se o histórico falhar, a confirmação é desfeita. Repetir uma confirmação mantém o primeiro autor, data e nota; o navegador consulta esse histórico no servidor.

O banco não aceita ID de colaborador ou data enviados pelo navegador: o autor vem de `auth.uid()` e a data vem da transição para `contacted`. A tabela `reservation_contact_events` não permite escrita direta pelo cliente. Apenas a equipe lê as notas internas. Clientes continuam consultando somente as próprias reservas; não recebem permissão para a listagem da equipe ou o histórico interno. Uma permissão da equipe removida impede novas operações no banco sem depender de renovar o token.

Reservas vencidas não podem ser reativadas pela confirmação. Contatos confirmados dentro de cinco dias iniciam negociação com prazo de 15 dias corridos. O sistema não detecta contatos externos sozinho e não envia mensagens: a equipe precisa registrar o contato no prazo. Confirmações feitas manualmente antes dessa migração permanecem válidas, mas não ganham autor ou nota retroativos. Use a tela para as novas confirmações, garantindo o registro do responsável.

## Acesso

RLS permite consultar apenas as próprias reservas. Usuários autenticados só podem inserir região e parcela; o banco fornece proprietário, protocolo, status e datas. Visitantes não recebem acesso. Alterações e exclusões pelo cliente são bloqueadas. A view usa `security_invoker`, preservando RLS. As visualizações 3D de construção continuam sendo simulações locais.

## Verificação

- `npm test`, `npx tsc --noEmit`, `npm run build`.
- `tests/area_reservations.sql` verifica isolamento, permissões e duplicatas no SQL Editor.
- `tests/reservation_deadline.sql` verifica 120 horas, liberação de parcela vencida, histórico e confirmação de contato.
- Os testes SQL usam uma transação com usuários temporários e terminam em ROLLBACK. Nenhum teste SQL foi executado automaticamente no projeto remoto.

## Perfis de acesso

Execute `migrations/202611040003_user_profiles.sql` no SQL Editor uma única vez, depois das migrações anteriores. Isso cria perfis para os usuários atuais e para novos cadastros, sempre como `client` (Cliente).

- `client`: usuário comum, com as próprias reservas.
- `collaborator`: integrante da equipe, com acesso às reservas em Atendimento e confirmação de contato por funções protegidas. Não gerencia perfis de usuários.
- `admin`: pode consultar os perfis e o histórico de alterações e atribuir perfis por `set_user_role`.

O papel vem de `public.user_profiles`, nunca dos metadados enviados pelo usuário no cadastro. Ninguém pode inserir, alterar ou excluir perfis diretamente pelo cliente. A função protegida `set_user_role(p_user_id, p_role)` verifica a permissão de administrador no banco, valida o destino e impede remover o último administrador por essa função. Mudanças concorrentes de perfil são serializadas. Alterações de papel geram registros em `user_role_changes`, visíveis somente aos administradores.

### Escolher o primeiro administrador

1. Confirme que a conta escolhida já existe em Authentication > Users.
2. Abra `setup/first_admin.sql` no VS Code.
3. Copie o conteúdo para uma nova consulta no SQL Editor do Supabase, como proprietário do projeto.
4. Substitua somente `SUBSTITUA-PELO-SEU-EMAIL-CADASTRADO` pelo e-mail exato da conta escolhida, dentro das aspas. Não salve e-mail pessoal no arquivo versionado.
5. Execute. O script falha se o e-mail não existir, a migração não tiver criado o perfil ou já houver administrador.

Não há promoção automática do primeiro usuário que se cadastrar. A operação inicial é exclusiva do proprietário no SQL Editor; não existe função de bootstrap disponível ao site. Depois disso, somente um administrador poderá usar `set_user_role` para nomear outros administradores ou colaboradores. O administrador do aplicativo é um perfil de usuário; isso não concede acesso ao painel do Supabase.

`src/lib/user-profiles.ts` e `src/hooks/use-user-role.ts` preparam a consulta e a gestão dos perfis para o futuro painel. A consulta usa uma chave de cache por usuário e trata erros sem conceder acesso. Mudanças de perfil valem para a autorização no banco imediatamente; a interface pode levar até 30 segundos para atualizar. A interface nunca substitui a validação de permissões do banco.

### Verificar os perfis

Execute `tests/user_profiles.sql` no SQL Editor após a migração 003. O teste cria usuários temporários e testa cadastro como cliente, bloqueio de promoção própria, isolamento entre perfis, acesso de administrador, histórico e remoção de privilégios. Tudo termina em ROLLBACK. O caso de último administrador só é executado quando a transação de teste tem exatamente um administrador, para não alterar perfis reais existentes.

Os testes dos perfis também foram preparados para execução em um PostgreSQL local isolado com uma representação mínima de `auth.users` e `auth.uid()`. Essa verificação não substitui validar no Supabase hospedado. A migração e o primeiro administrador ainda precisam ser configurados no projeto remoto; o atendimento da equipe está descrito na seção Confirmação pela equipe.

## Tela de administração

A rota `/admin` lista usuários já cadastrados, com e-mail, ID, data de cadastro e perfil. Administradores podem buscar por e-mail/ID, filtrar por perfil, percorrer páginas de 20 usuários e confirmar mudanças de perfil. O link Administração aparece junto ao botão de sair. Clientes, colaboradores e visitantes não recebem a lista.

Antes de abrir a lista, execute `migrations/202611040004_admin_user_list.sql` no SQL Editor uma única vez. Não reexecute as migrações anteriores nem o bootstrap do primeiro administrador. Essa migração cria `admin_list_users`, uma função que confere o perfil no banco e retorna somente os dados necessários à tela, com limite máximo de 100 resultados por chamada. Senhas e metadados de autenticação não são retornados.

A troca de perfil usa a função já existente `set_user_role`, preservando o histórico e a proteção do último administrador. A tela pede confirmação e só informa sucesso após salvar. Se um administrador rebaixar o próprio perfil, o acesso ao painel é removido e a lista em cache é descartada. Ao sair da conta, os caches de administração também são removidos.

A tela Pessoas e perfis não cria contas novas. O contato das reservas é confirmado na tela Atendimento. Colaboradores não recebem acesso à lista administrativa de usuários. Testes específicos: `src/test/admin-users.test.tsx` e `supabase/tests/admin_user_list.sql` (transação reversível pelo SQL Editor).


Testes de atendimento: src/test/team-reservations.test.ts, src/test/team-reservations-ui.test.tsx e supabase/tests/reservation_contact.sql. O teste SQL cobre prazo, isolamento de notas, autoria, repetição sem duplicatas, remoção de permissão e falha do histórico com reversão do status. Os testes locais não alteram o Supabase remoto.

## Confirmação de senha ao abrir Administração

O login continua abrindo a página inicial. Ao clicar em Administração ou abrir `/admin`, uma conta administradora precisa confirmar novamente sua própria senha antes que o componente da lista de usuários seja montado. O e-mail vem da conta atual e não pode ser editado nessa tela. Ao voltar ao site, recarregar o painel ou trocar de conta, a confirmação é descartada.

A senha é validada no Supabase Auth por um cliente temporário sem persistência, sem renovação automática e com armazenamento isolado. A sessão temporária é encerrada com escopo local após a verificação. A sessão original do site é conferida antes e depois da senha, assim como o perfil de administrador. A senha é apagada do formulário após cada tentativa e não é salva em arquivos ou no armazenamento do navegador.

Esta confirmação controla a abertura da tela; as APIs continuam autorizadas pelas permissões de perfil no banco. Ela não implementa MFA ou uma política adicional de reautenticação para chamadas diretas à API. Atendimento mantém o fluxo de acesso da equipe. Não é necessário executar uma nova migração SQL para esta confirmação.

## Encerramento da negociação em 15 dias

Depois de aplicar a migração de contato, execute no SQL Editor, uma única vez cada e nesta ordem:

1. `migrations/202611050002_negotiation_resolution.sql`: prazo, confirmação definitiva, desativação, histórico e permissões.
2. `migrations/202611050003_negotiation_schedule.sql`: habilita pg_cron e agenda a desativação automática a cada minuto.

Não reexecute as migrações anteriores. Criar os arquivos locais não aplica mudanças ao projeto remoto. A segunda migração exige o proprietário do projeto e a extensão pg_cron disponível.

A equipe registra o contato dentro dos primeiros cinco dias. Esse registro inicia 360 horas (15 dias corridos) de negociação. Em Atendimento, use Encerrar negociação, escolha Confirmar reserva ou Desativar e liberar área e revise a decisão antes de salvar. A confirmação definitiva mantém a área indisponível mesmo depois do prazo. A desativação libera a área. São decisões finais neste fluxo, sem reabertura por essa função.

Sem confirmação definitiva no prazo, a reserva é desativada automaticamente. A view mostra a desativação no instante do vencimento; uma nova solicitação também libera a área vencida antes de inserir. O agendamento atualiza os registros e grava o evento mesmo com o site fechado, com intervalo de até um minuto. Contatos existentes recebem o prazo contado do registro original; negociações já vencidas serão desativadas ao aplicar a primeira migração.

O banco verifica perfil de equipe, prazo, transição e exclusividade da parcela. Confirmação e evento de histórico são atômicos; repetir a mesma decisão preserva autor, data e nota. Clientes veem somente suas reservas, sem as notas internas. A manutenção automática não é executável pelo navegador. O histórico distingue decisão da equipe de vencimento automático. Nenhum e-mail ou IA foi integrado nesta etapa.

Para conferir a ativação do agendamento no Supabase:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'expire-reservation-negotiations';
```

O resultado deve mostrar `schedule = * * * * *` e `active = true`. As regras e os testes SQL foram validados em PostgreSQL local isolado (PGlite), incluindo liberação antes do agendamento, reserva confirmada que não expira, permissões, histórico e reversão quando o histórico falha. O agendamento pg_cron não roda no PGlite e precisa ser aplicado e verificado no Supabase. Teste SQL reversível: `tests/negotiation_resolution.sql`.

## Cadastro de clientes

Na tela de login, use Ainda não tem conta? Criar conta. O formulário pede nome completo, e-mail, senha (mínimo de oito caracteres) e confirmação da senha. Usa Supabase Auth signUp, envia somente full_name como metadado e nunca envia perfil. O trigger da migração 003 cria o perfil client; esta etapa não exige nova migração.

Quando a confirmação de e-mail está habilitada, o formulário orienta verificar a caixa de entrada e não abre uma sessão antecipadamente. Com confirmação desabilitada e sessão retornada pelo Supabase, abre a página inicial. Nome fica nos metadados do usuário em Authentication, sem criar uma segunda fonte de permissões. Senhas são tratadas pelo Auth, nunca salvas nas tabelas do aplicativo.

Em Authentication, configure Site URL e Redirect URLs para permitir a origem usada pelo site (em desenvolvimento, http://localhost:8080/; em produção, o domínio publicado). O retorno do e-mail aponta para a tela de login da origem atual. O envio depende da configuração de e-mail e dos limites do Supabase; a interface mostra falhas de envio sem declarar sucesso. O teste do formulário usa respostas simuladas e não cria contas reais nem envia mensagens.

## Disponibilidade compartilhada no mapa

Execute uma única vez `migrations/202611050004_map_availability.sql` no SQL Editor, após a migração de encerramento da negociação. Não reexecute as anteriores. Contas autenticadas consultam região, parcela, situação resumida e prazo da ocupação por `map_area_availability()`. Nome, e-mail, protocolo, notas e ID do cliente não são retornados; a política de leitura das próprias reservas continua igual. Visitantes não consultam essa função.

Reservas ativas aparecem em laranja; confirmações definitivas, em dourado. As regiões indicam quantas parcelas estão indisponíveis e o painel oferece uma grade com situação por texto. Selecionar uma área de outra conta mostra o bloqueio de nova solicitação. O mapa consulta novamente ao abrir, trocar de usuário, voltar à aba e a cada 15 segundos. O índice único do banco continua impedindo duplicatas mesmo entre atualizações. Falha de consulta é apresentada como erro, sem prometer disponibilidade.

O relógio do banco exclui pendências vencidas e negociações vencidas, mesmo antes da limpeza agendada; desativadas e expiradas não aparecem. A interface retira ocupações temporárias no limite recebido e mantém confirmações definitivas. A simulação 3D de casas continua local e separada das reservas do banco. Teste SQL: `tests/map_availability.sql`; testes da interface e consulta: `src/test/map-availability.test.tsx` e `src/test/parcel-availability.test.ts`.

## Cancelamento pelo cliente

Execute uma única vez `migrations/202611050005_client_cancellation.sql` no SQL Editor, depois da disponibilidade do mapa. Não reexecute as anteriores. Em Minhas reservas, o cliente usa Cancelar minha reserva e revisa a liberação da área antes de confirmar. Pode desistir da ação usando Manter reserva. O botão aparece somente em pendências e negociações ativas. Negociações definitivamente concluídas não podem ser canceladas pelo cliente.

A RPC `cancel_my_reservation(p_reservation_id)` identifica o proprietário por auth.uid(), usa o mesmo lock por parcela e confere novamente a situação após aguardar a transação anterior. Recusa reservas de outra conta e concluídas, desativadas ou vencidas. O cliente não recebe UPDATE direto. Status cancelled, data e evento de cancelamento são salvos atomicamente; uma repetição preserva o primeiro evento. O histórico de contato anterior é mantido. Falha na gravação do evento desfaz o cancelamento.

O estado cancelled libera o índice da parcela e sai da consulta do mapa. A interface atualiza o histórico e invalida as consultas de disponibilidade após a resposta do servidor. Outras contas veem a atualização ao voltar ao mapa ou na próxima consulta de 15 segundos. Atendimento inclui o filtro Reserva cancelada e identifica o cancelamento pelo cliente. Casas simuladas continuam independentes do cadastro de reservas. Não há envio de e-mail nesta operação.

Testes: `tests/client_cancellation.sql` em transação reversível, testes de API e confirmação em `src/test/reservation-cancellation.test.ts` e `src/test/reservation-cancellation-ui.test.tsx`, e critérios de exibição em `src/test/reservation-ui.test.tsx`.

## Recuperação de senha

A tela de login oferece Esqueci minha senha, que abre `/recuperar-senha`. O pedido chama Supabase Auth resetPasswordForEmail com retorno em `/redefinir-senha`, na mesma origem do site. A mensagem não informa se a conta existe; erros de envio e limites não são apresentados como sucesso. Nenhuma nova migração SQL é necessária.

No Supabase, em Authentication > URL Configuration > Redirect URLs, adicione `http://localhost:8080/redefinir-senha` para testes locais. Ao publicar, adicione também a URL exata `/redefinir-senha` no domínio publicado e confira Site URL. O envio real depende da configuração de e-mail/SMTP e dos limites do projeto. Não é suficiente copiar somente os arquivos para receber mensagens. Preserve o link de confirmação do Supabase se alterar o modelo do e-mail.

O fluxo usa o formato implícito do cliente atual: o Supabase verifica o link enviado e retorna tokens com type=recovery no fragmento da URL. A tela captura o fragmento, limpa a barra de endereço e valida a sessão em um cliente isolado, sem armazenamento persistente, sem renovação automática e sem usar a sessão normal do site. Links ausentes, de outro tipo ou rejeitados não abrem o formulário de nova senha. Se a configuração redirecionar para a raiz com type=recovery, a tela de login encaminha para a recuperação. Código PKCE e modelos personalizados com token_hash não fazem parte deste fluxo.

A nova senha e sua confirmação devem coincidir e ter pelo menos oito caracteres. O servidor aplica as demais regras de senha. Antes da alteração, a identidade recuperada é conferida; a chamada updateUser envia apenas a nova senha. Após a resposta válida, a sessão de recuperação é encerrada com escopo local e a pessoa volta ao login para entrar. A sessão normal de outra conta não é substituída por este fluxo. Credenciais não são registradas em arquivos, logs ou tabelas. A sessão é mantida somente em memória; recarregar a página após remover os tokens exige abrir o link novamente ou solicitar outro.

Testes automatizados e no navegador usam respostas simuladas, sem criar usuários nem enviar e-mails reais. Para validar o projeto hospedado, use Esqueci minha senha com uma conta sua, abra o e-mail mais recente e entre com a nova senha depois da alteração.

Referências oficiais: https://supabase.com/docs/guides/auth/passwords e https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail.
