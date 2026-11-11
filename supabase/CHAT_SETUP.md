# Chat de reservas com IA e equipe humana

A implementação local inclui histórico de conversa por reserva, assistente de IA com Gemini (Google) e encaminhamento para colaboradores/administradores. Para ativar no projeto hospedado, aplique o SQL e publique a função abaixo. A chave do Gemini será configurada por você diretamente no Supabase, sem ser enviada pelo chat ou salva no repositório.

## 1. Criar as tabelas e funções

No SQL Editor do Supabase, crie uma nova consulta e execute todo o conteúdo de [202611090001_reservation_chat.sql](migrations/202611090001_reservation_chat.sql), uma única vez. As migrações anteriores, até cancelamento de reservas, precisam estar aplicadas. Não reexecute arquivos antigos.

Depois, execute uma única vez [202611090002_commercial_terms.sql](migrations/202611090002_commercial_terms.sql), que cria o cadastro de condições aprovadas. Se a primeira migração já foi aplicada, execute somente a segunda. Não há preços iniciais cadastrados.

O primeiro arquivo cria conversas, mensagens e controle dos turnos da IA. Também cria funções que verificam a identidade do usuário e seu perfil antes de consultar ou escrever. A IA não altera o status da reserva nem confirma contato automaticamente.

## 2. Configurar a chave do Gemini

Para respostas sobre quantos lotes de terra estão disponíveis, aplique também, uma única vez,
[202611110001_ai_lot_availability.sql](migrations/202611110001_ai_lot_availability.sql).
Depois publique novamente `reservation-assistant`. A consulta retorna somente contagens por região,
sem dados pessoais. Desconta reservas ativas e confirmações; reservas vencidas e canceladas não ocupam lotes.
O especialista e o atendimento de reservas respondem com horário de consulta, sem prever disponibilidade futura.
Essa resposta usa o banco diretamente e não depende de uma chamada ao Gemini.

Abra [Google AI Studio — API Keys](https://aistudio.google.com/api-keys), entre com sua conta Google e crie uma chave para o projeto. Copie a chave diretamente para os Secrets do Supabase; não a envie por mensagens.

No projeto Supabase, abra **Edge Functions → Secrets** e adicione:

| Nome | Valor |
| --- | --- |
| GEMINI_API_KEY | Sua chave de API do Google AI Studio |
| GEMINI_MODEL | gemini-3.5-flash-lite (opcional; este é o padrão) |

O modelo possui faixa gratuita, sujeita à elegibilidade, à região, aos limites e à disponibilidade do projeto Google. Confira a cota efetiva no AI Studio; o código não cria créditos nem garante gratuidade. Para começar sem cobrança de uso da IA, utilize um projeto na faixa gratuita e confira o faturamento antes de habilitar serviços pagos. Hospedagem e Supabase têm seus próprios planos.

Na faixa gratuita, entradas e respostas podem ser usadas pelo Google para melhorar seus produtos. Comece com dados fictícios e revise o tratamento dos dados antes de usar conversas reais de clientes. A interface identifica o envio para Google (Gemini).

Use sua chave somente no painel de Secrets. Não use VITE_GEMINI_API_KEY nem cole a chave no código, no SQL, no GitHub ou nesta conversa. Os testes locais usam respostas simuladas, sem chamadas ao provedor.

O Supabase fornece `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` à função hospedada. A chave administrativa serve somente ao servidor; o navegador continua usando a chave pública. Não substitua as variáveis públicas do frontend por uma chave administrativa.

## 3. Publicar a função

A função se chama **reservation-assistant** e contém dois arquivos:

- [index.ts](functions/reservation-assistant/index.ts): entrada e autenticação Supabase.
- [handler.ts](functions/reservation-assistant/handler.ts): validação, chamada do Gemini e encaminhamento.

### Opção pelo terminal

Com a CLI do Supabase disponível, execute na pasta do projeto:

```sh
supabase login
supabase functions deploy reservation-assistant --project-ref SEU_PROJECT_REF
```

Substitua `SEU_PROJECT_REF` pelo identificador do seu projeto. O arquivo [config.toml](config.toml) mantém `verify_jwt = true`. A função também chama `auth.getUser` para verificar a identidade; o ID do cliente não vem do corpo enviado pelo navegador.

### Opção pelo painel

Abra **Edge Functions → Deploy a new function → Via Editor**. Crie a função com o nome `reservation-assistant`. Mantenha os dois arquivos acima na mesma pasta do editor, com os nomes `index.ts` e `handler.ts`, e copie seus conteúdos completos. O import `./handler.ts` precisa encontrar esse segundo arquivo. Caso o editor não ofereça suporte a arquivos adicionais, use a CLI para publicar a pasta completa. Mantenha a verificação de JWT habilitada e clique em **Deploy function**.

Não cole o código TypeScript no SQL Editor: esse editor é somente para a migração do passo 1. Configurar Secrets não publica a função; a publicação é uma etapa separada.

## 4. Cadastrar condições aprovadas

Entre como administradora e abra **Condições comerciais** no menu da conta (/condicoes-comerciais). Confirme sua senha para abrir a tela. A autorização das funções é verificada pelo perfil no banco, inclusive em chamadas diretas.

Escolha a região, informe preço fixo de referência, a partir de ou sob consulta, entrada, máximo de parcelas, juros mensais, formas aceitas e observações. As condições são referências para as parcelas da região, não propostas individuais. Campos em branco não significam gratuidade; juros zero precisam ser informados explicitamente. Use valores como 12345,67, sem separador de milhar.

Clique em **Revisar e aprovar para a IA**, confira o resumo e confirme. **Salvar como rascunho** retira a condição do atendimento automático, inclusive uma aprovação anterior. O banco guarda autor, versões e histórico; alterações concorrentes exigem atualizar a lista. Preços ilustrativos do mapa e ofertas do site não são importados.

A IA consulta a versão aprovada antes de cada nova resposta. Ela pode conversar sobre valores, prazos e formas aceitas, informar limitações e fazer perguntas. Não calcula financiamentos, cobra pagamentos, concede descontos nem conclui negociações. Condições não cadastradas serão informadas como pendentes. Uma resposta já em geração pode refletir a versão consultada no início; a equipe pode interromper a IA a qualquer momento.

Se a função já estava publicada, publique novamente os dois arquivos atualizados. Esta versão usa exclusivamente GEMINI_API_KEY e GEMINI_MODEL; Secrets antigos da OpenAI ou Anthropic não são consultados. A troca de provedor não exige uma migração SQL adicional. Se as tabelas e funções já existem, não reexecute as migrações. Se GEMINI_MODEL estiver definido, ele prevalece sobre o padrão do código.

## 5. Testar o atendimento

1. Execute `npm run dev` e abra `http://localhost:8080/`.
2. Entre com uma conta de cliente que tenha uma reserva.
3. Em **Minhas reservas**, clique em **Conversar sobre esta reserva**.
4. Envie uma dúvida como “Qual o prazo para entrar em contato?”. O histórico identifica a resposta como **Assistente de IA**.
5. Clique em **Falar com a equipe**. A conversa muda para **Aguardando equipe**.
6. Em outro navegador ou janela privada, entre com uma conta Colaborador ou Administrador.
7. Clique em **Conversas**, selecione a reserva, acompanhe as mensagens sem interromper a IA. Use **Interromper IA e assumir** (ou **Assumir atendimento**, se já estiver aguardando equipe) e envie a resposta.
8. Confira se o cliente recebe a resposta na mesma conversa.

A tela consulta mensagens a cada cinco segundos e a fila a cada dez segundos. Não há promessa de atendimento humano imediato. As últimas 100 mensagens e 100 conversas são exibidas; registros anteriores permanecem no banco. O encerramento da negociação continua em Atendimento.

## Regras e limites desta etapa

- O cliente acessa somente conversas das próprias reservas. A equipe acessa a fila e o histórico; remover o perfil de equipe bloqueia novas operações.
- Uma conversa por reserva, com os modos IA, Aguardando equipe e Atendimento humano.
- Mensagens do cliente e da equipe têm até 2000 caracteres; limite de dez mensagens por minuto por remetente, verificado no banco.
- Até vinte tentativas de resposta da IA por cliente em uma janela móvel de 24 horas, compartilhadas entre suas reservas. Falhas também consomem tentativas; esse limite não representa um teto financeiro da conta Google.
- Uma única tentativa de geração por mensagem. Repetir a solicitação não gera outra chamada para o mesmo turno. A função espera até quarenta segundos pelo Gemini e não repete a chamada automaticamente.
- As últimas doze mensagens, os dados mínimos da reserva (região, parcela, situação e prazos) e as condições comerciais aprovadas da região são enviados ao Google (Gemini). E-mail, usuário, protocolo e notas internas não são adicionados ao contexto. O texto escrito pelo cliente é enviado como parte da conversa, conforme informado na interface.
- A resposta usa generateContent com responseMimeType application/json e responseJsonSchema, com validação adicional no servidor. Respostas incompletas, recusas e falhas de validação encaminham à equipe. A integração não promete retenção zero pelo provedor.
- A IA responde dúvidas sobre regras, preços e formas de pagamento aprovados; encaminha pedidos de pessoa, exceções, descontos, propostas individuais, pagamentos e ações à equipe. Ela não recebe ferramentas para confirmar, cancelar, prorrogar ou concluir reservas.
- Conversar com a IA, pedir atendimento ou receber uma resposta humana não altera os prazos. O contato deve ser registrado pela equipe antes de vencer a reserva.
- Ao solicitar a equipe, a IA deixa de responder àquela conversa. A tomada de atendimento por um humano tem prioridade sobre uma resposta automática em andamento.
- Sem chave, em caso de falha, bloqueio de segurança ou limite de uso do Gemini, a conversa segue para a equipe. Se a função ainda não estiver publicada, o frontend tenta registrar o encaminhamento pelo banco e informa falhas sem apagar a mensagem.
- Conversas já encaminhadas continuam com a equipe após configurar a chave. Para testar uma primeira resposta da IA depois da configuração, use uma reserva que ainda não tenha iniciado conversa. Não há botão de retorno da equipe para a IA nesta etapa.
- Uma interrupção abrupta da função pode deixar um turno sem resposta. O cliente pode usar Falar com a equipe; depois de 75 segundos, pode enviar outra mensagem. O mesmo turno não é cobrado novamente pelo aplicativo.
- Sem anexos, envio de e-mail, notificações externas ou execução de ações na reserva nesta primeira versão.

## Verificação técnica

- `npm test`: interface e função com respostas simuladas do Gemini e do Supabase.
- `npx tsc --noEmit`: tipos da aplicação e do handler compartilhado com os testes.
- `deno check supabase/functions/reservation-assistant/index.ts`: tipos da função no runtime Deno.
- `supabase/tests/reservation_chat.sql`: isolamento, autoria, idempotência, encaminhamento, retirada de permissão, limite de uso e ausência de mudanças na reserva. Transação reversível, para ambiente de desenvolvimento.

Criar os arquivos localmente não altera o projeto remoto. A validação local não substitui aplicar a migração, publicar a função e testar com sua configuração real. Nenhuma chave real do Gemini foi necessária para os testes automatizados.

## Referências oficiais

- [Google: saídas estruturadas](https://ai.google.dev/gemini-api/docs/generate-content/structured-output)
- [Google: Gemini Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)
- [Google: chaves de API](https://ai.google.dev/gemini-api/docs/api-key)
- [Google: preços e faixa gratuita](https://ai.google.dev/gemini-api/docs/pricing)
- [Supabase: Secrets](https://supabase.com/docs/guides/functions/secrets)
- [Supabase: autenticação das funções](https://supabase.com/docs/guides/functions/auth-headers)
- [Supabase: publicação pelo painel](https://supabase.com/docs/guides/functions/quickstart-dashboard)

## Especialista educativo de Marte

O botão **Falar com especialista** e o item **Especialista** do menu móvel abrem uma conversa sobre preços e pagamentos aprovados por região, além de clima, condições atmosféricas, temperaturas, relevo e duração do dia/ano de Marte. É necessário login, mas não uma reserva. A base educativa usa referências da NASA; não há previsão meteorológica em tempo real nem levantamento topográfico por parcela.

Para ativar este recurso novo:
1. Execute uma única vez [202611090003_mars_specialist.sql](migrations/202611090003_mars_specialist.sql). Não reexecute 001 ou 002 que já estão aplicadas.
2. Republique reservation-assistant com os dois arquivos atualizados, index.ts e handler.ts. Os Secrets GEMINI_API_KEY e GEMINI_MODEL continuam sendo utilizados.
3. Publique a versão atualizada do site e teste o botão em /inicio.

A função valida a conta antes de solicitar uma resposta. Uma função exclusiva do servidor registra apenas usuário, identificador da tentativa e horário, permitindo cinco perguntas por minuto e vinte tentativas por 24 horas por usuário. A cota educativa é independente da cota do chat de reservas e não representa teto financeiro global. Falhas após a autorização da tentativa também consomem essa cota; o aplicativo não repete a chamada automaticamente.

O histórico educativo fica em memória enquanto o diálogo estiver aberto e é limpo ao fechar, trocar de conta ou clicar em Nova conversa. Até doze mensagens recentes, com até 8000 caracteres no total, são usadas como contexto. O servidor não salva essas mensagens; elas são enviadas ao Google para gerar a resposta. O histórico e o acompanhamento da equipe nas conversas de reservas continuam no fluxo /chat. O link Conversas de reservas permite seguir para esse atendimento sem afirmar um encaminhamento que não ocorreu.

Referências científicas:
- [NASA — Marte](https://science.nasa.gov/mars/facts/)
- [NASA — temperaturas do Sistema Solar](https://science.nasa.gov/solar-system/temperatures-across-our-solar-system/)
- [NASA — tempo marciano](https://science.nasa.gov/resource/living-on-mars-time/)

Teste SQL isolado: supabase/tests/mars_specialist.sql. Os testes de aplicação e de Edge Function usam respostas simuladas, sem consultar a API real.
## Quando todas as perguntas vão para a equipe

O especialista educativo de Marte não faz encaminhamento automático: ele responde ou informa um erro. Se ele apresenta atendimento de reservas, confira se publicou os dois arquivos atuais e se o site acessa o mesmo projeto Supabase. Não basta salvar os Secrets; versões antigas da função podem usar outro provedor ou não reconhecer mode=mars.

A versão atual inclui revision=gemini-mars-diagnostics-1 nas respostas JSON. Ela registra eventos assistant_failure em Edge Functions → reservation-assistant → Logs, contendo somente revisão, fluxo (mars/reservation) e código seguro. Não registra chave, token, identificação do usuário, perguntas ou resposta do provedor. Em Invocations, confira status e revisão da resposta; não compartilhe cabeçalhos de autenticação ou conversas.

| Código seguro | O que verificar |
| --- | --- |
| AI_KEY_MISSING | Secret GEMINI_API_KEY no mesmo projeto da função; cole somente a chave |
| AI_MODEL_INVALID | Secret GEMINI_MODEL: nome do modelo, sem URL, aspas ou espaços internos |
| GEMINI_ACCESS_DENIED | Permissões, validade da chave e acesso do projeto Google à API |
| GEMINI_MODEL_UNAVAILABLE | Disponibilidade do modelo configurado para sua conta Google |
| GEMINI_QUOTA | Cotas efetivas no AI Studio; não troca automaticamente para um plano pago |
| GEMINI_REQUEST_REJECTED | Parâmetros e requisitos do projeto Google; não significa necessariamente chave inválida |
| AI_DATABASE_MISSING | Função SQL ausente; confira a migração correspondente antes de executar scripts |
| AI_DATABASE_UNAVAILABLE | Acesso ao banco e funções esperadas pela integração |
| AI_TIMEOUT | O provedor demorou a responder |
| AI_OUTPUT_INVALID | Resposta bloqueada, incompleta ou fora do formato esperado |
| AI_UNAVAILABLE | Indisponibilidade temporária ou falha de rede |

Um erro 401 antes da execução pode vir da verificação de autenticação do Supabase; um 404 pode indicar função ausente. Confira Invocations caso não exista evento assistant_failure. Não desabilite autenticação como tentativa genérica de correção.

Uma conversa de reserva já encaminhada permanece em Aguardando equipe ou Atendimento humano: corrigir Secrets não retorna automaticamente a conversa à IA. O especialista educativo não exige nova reserva e pode ser usado para testar a integração após a republicação.

A identificação exata do problema no ambiente remoto depende dos Logs/Invocations. Alterações locais e testes simulados não confirmam o funcionamento da chave real.
## Preços e pagamentos sem encaminhamento automático

O especialista e o chat de reserva no modo IA consultam a função existente get_ai_commercial_terms. Ela retorna apenas condições publicadas. Não é necessária nova migração SQL para esta atualização; republicar os dois arquivos da Edge Function e o site atualizado é suficiente, com as migrações anteriores já aplicadas.

Perguntas simples como “Qual é o preço de Elysium?” ou “Quais as formas de pagamento?” são respondidas diretamente com o catálogo aprovado, sem chamar Gemini e sem acionar a equipe. A pergunta sem região pede esclarecimento; uma resposta como “Elysium” continua a consulta. O chat da reserva usa sua região como contexto inicial. São exibidos preço de referência ou a partir de, entrada, máximo de parcelas, juros, formas aceitas e observações aprovadas. Não é feito cálculo de financiamento.

A consulta direta também funciona quando a chave Gemini ainda não foi configurada, desde que o banco e os limites de uso estejam configurados. Os limites locais continuam contando cada pergunta; não há geração paga para uma resposta direta. Outras dúvidas continuam usando Gemini, com o catálogo aprovado como contexto para perguntas comerciais menos padronizadas.

Se não houver condições aprovadas para a região, o assistente informa a ausência e oferece consultar outra região. Campos vazios não viram zero, listas vazias não viram todas as formas aceitas e os preços ilustrativos do mapa não são importados. Falhas ao consultar o banco são informadas como erro, sem inventar uma cotação.

Para preparar os dados, entre como administradora em /condicoes-comerciais, preencha a região, revise e confirme a aprovação. Salvar como rascunho retira os valores das próximas consultas. As condições atuais prevalecem sobre valores citados antes na conversa.

Conversas de reservas que já estão em waiting_team ou human continuam com a equipe. Esta atualização não retoma automaticamente uma conversa assumida por humanos. Use Falar com especialista para uma consulta ao catálogo independente da reserva.
