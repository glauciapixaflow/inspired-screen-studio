# Red Planet Properties — Inspired Screen Studio

Aplicação para explorar regiões de Marte em um mapa 3D, cadastrar clientes, reservar parcelas e acompanhar negociações com a equipe. O repositório inclui a interface, a integração com Supabase e os scripts SQL do banco.

## Acessar os arquivos

Abra o [repositório no GitHub](https://github.com/glauciapixaflow/inspired-screen-studio). Se o repositório estiver privado, solicite acesso à proprietária usando sua conta do GitHub.

Você pode navegar pelos arquivos no navegador ou baixar uma cópia:

- **Com Git:** siga os comandos abaixo para clonar o projeto.
- **Sem Git:** no GitHub, use **Code → Download ZIP**, extraia o arquivo e abra a pasta no VS Code.

```sh
git clone https://github.com/glauciapixaflow/inspired-screen-studio.git
cd inspired-screen-studio
```

Se baixou o ZIP, a pasta normalmente se chama `inspired-screen-studio-main`. Abra o terminal dentro da pasta que contém `package.json` antes de executar os comandos npm.

> O endereço do GitHub mostra os arquivos. O endereço `http://localhost:8080/` abre o site somente no computador onde ele está rodando. Compartilhar o site por um endereço público exige publicar a aplicação em uma hospedagem.

## O que já está implementado

- Cadastro, login e recuperação de senha por e-mail com Supabase Auth.
- Perfis Cliente, Colaborador e Administrador.
- Mapa 3D com indicação de parcelas reservadas e confirmadas entre contas.
- Histórico de reservas do cliente e painel de atendimento da equipe.
- Cinco dias para registrar o contato; depois, quinze dias de negociação.
- Confirmação definitiva, desativação por prazo e cancelamento pelo cliente antes da conclusão.
- Histórico das decisões e permissões verificadas no banco.
- Simulações 3D de construção e exploração de loteamentos, mantidas no estado local da sessão.

As reservas registram interesse para negociação; a simulação 3D não registra uma compra. O chat por reserva, com IA e encaminhamento humano, está preparado e depende da migração, publicação da função e chave Gemini (Google) descritas em [supabase/CHAT_SETUP.md](supabase/CHAT_SETUP.md). Avisos automáticos de reserva por e-mail ainda não estão implementados.

## Requisitos

- Node.js **22.12 ou superior**, compatível com as dependências atuais.
- npm, instalado com o Node.js.
- Git, para clonar e enviar alterações; dispensável para baixar o ZIP.
- Um projeto Supabase configurado, ou acesso autorizado ao projeto utilizado pela equipe.

Tecnologias principais: TypeScript, React, TanStack Start/Router/Query, Vite, Three.js e PostgreSQL/Supabase. Consulte as versões em [package.json](package.json).

## Executar o projeto localmente

### 1. Instalar as dependências

Na pasta que contém `package.json`, execute:

```sh
npm ci
```

O projeto usa `package-lock.json` para a instalação com npm.

### 2. Configurar o Supabase

Crie `.env.local` na mesma pasta de `package.json`, usando [.env.example](.env.example) como modelo. No PowerShell, em uma cópia nova do projeto:

```powershell
Copy-Item .env.example .env.local
```

Preencha com os valores do seu projeto Supabase:

```dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA-CHAVE-PUBLICA-PUBLISHABLE
```

Use a chave pública **publishable**, nunca uma chave `secret` ou `service_role` no navegador. As variáveis `VITE_` são incluídas no código do cliente. O arquivo `.env.local` é ignorado pelo Git e não deve ser enviado ao repositório. Solicite à equipe as configurações autorizadas por um canal privado.

### 3. Preparar o banco, quando necessário

**Se estiver usando o projeto da equipe já configurado:** não execute novamente as migrações. Confirme com a responsável quais arquivos já foram aplicados.

**Se estiver configurando um novo projeto Supabase:** execute os arquivos de [supabase/migrations](supabase/migrations/) no SQL Editor, na ordem abaixo, uma única vez cada. Execute o conteúdo completo de um arquivo por consulta.

1. `202611040001_area_reservations.sql`
2. `202611040002_reservation_deadline.sql`
3. `202611040003_user_profiles.sql`
4. `202611040004_admin_user_list.sql`
5. `202611050001_reservation_contact.sql`
6. `202611050002_negotiation_resolution.sql`
7. `202611050003_negotiation_schedule.sql`
8. `202611050004_map_availability.sql`
9. `202611050005_client_cancellation.sql`
10. `202611090001_reservation_chat.sql`

O agendamento de desativação usa `pg_cron`. A criação do primeiro administrador é uma operação separada do proprietário, descrita em [supabase/README.md](supabase/README.md), usando [supabase/setup/first_admin.sql](supabase/setup/first_admin.sql) após cadastrar a conta escolhida. Novos usuários sempre começam como clientes; um administrador atribui o perfil de colaborador pelo painel.

Copiar os arquivos ou enviá-los ao GitHub não aplica mudanças no banco remoto. Consulte o [guia do backend](supabase/README.md) para conhecer as regras, permissões, testes SQL e configurações de autenticação.

### 4. Configurar o retorno dos e-mails

No projeto Supabase, em **Authentication → URL Configuration → Redirect URLs**, autorize as URLs locais:

```text
http://localhost:8080/
http://localhost:8080/redefinir-senha
```

Confira também **Site URL**. Ao publicar, configure as URLs correspondentes ao domínio publicado. O envio real de confirmação de cadastro e recuperação depende da configuração de e-mail/SMTP e dos limites do Supabase.

### 5. Iniciar o site

```sh
npm run dev
```

Abra o endereço informado no terminal, normalmente **http://localhost:8080/**. Mantenha o terminal em execução. Para encerrar, pressione `Ctrl+C`. Se alterar `.env.local`, reinicie o servidor.

## Páginas disponíveis

| Caminho            | Finalidade                                                               |
| ------------------ | ------------------------------------------------------------------------ |
| `/`                | Login e opção de criar conta                                             |
| `/inicio`          | Página inicial e Minhas reservas                                         |
| `/mapa`            | Mapa 3D e escolha de parcelas                                            |
| `/recuperar-senha` | Solicitar e-mail de recuperação                                          |
| `/redefinir-senha` | Definir a senha pelo link recebido                                       |
| `/atendimento`     | Reservas e negociações, para colaboradores e administradores             |
| `/chat`            | Conversas por reserva, assistente de IA e atendimento humano             |
| `/admin`           | Pessoas e perfis, exclusivo de administradores, com confirmação de senha |

Abrir `/redefinir-senha` diretamente, sem um link válido de recuperação, mostra uma orientação para solicitar outro e-mail.

## Onde encontrar os arquivos

| Pasta ou arquivo                              | Conteúdo                                                |
| --------------------------------------------- | ------------------------------------------------------- |
| [src/routes](src/routes/)                     | Rotas e páginas                                         |
| [src/components](src/components/)             | Interface e cenas 3D                                    |
| [src/components/admin](src/components/admin/) | Telas da equipe e administração                         |
| [src/hooks](src/hooks/)                       | Consultas, autenticação e estados compartilhados        |
| [src/lib](src/lib/)                           | Integrações, regras da interface e dados do mapa        |
| [src/test](src/test/)                         | Testes automatizados da aplicação                       |
| [src/styles.css](src/styles.css)              | Estilos e cores do projeto                              |
| [supabase/migrations](supabase/migrations/)   | Criação e evolução do banco                             |
| [supabase/setup](supabase/setup/)             | Configuração inicial do administrador                   |
| [supabase/tests](supabase/tests/)             | Testes SQL com dados temporários e rollback             |
| [.env.example](.env.example)                  | Modelo das variáveis de ambiente, sem credenciais reais |
| [package.json](package.json)                  | Dependências e comandos do projeto                      |

## Comandos de desenvolvimento

| Comando              | Uso                                       |
| -------------------- | ----------------------------------------- |
| `npm run dev`        | Executar localmente                       |
| `npm test`           | Executar os testes da aplicação           |
| `npm run test:watch` | Executar testes durante o desenvolvimento |
| `npx tsc --noEmit`   | Conferir os tipos TypeScript              |
| `npm run lint`       | Verificar o código com ESLint             |
| `npm run build`      | Gerar a versão de produção e as rotas     |
| `npm run preview`    | Visualizar a versão gerada, após o build  |

Testes da aplicação com respostas simuladas não enviam e-mails nem substituem a validação da configuração no Supabase. Os testes SQL devem ser usados em um ambiente de desenvolvimento com as migrações já aplicadas; veja o [guia do backend](supabase/README.md).

## Colaborar com alterações

Para uma nova melhoria, atualize sua cópia e crie uma branch:

```sh
git checkout main
git pull --ff-only origin main
git checkout -b minha-melhoria
```

Depois de editar, conferir e testar, revise os arquivos que serão enviados:

```sh
git status
git add CAMINHO_DO_ARQUIVO
git commit -m "Descreve a melhoria realizada"
git push -u origin minha-melhoria
```

Substitua `CAMINHO_DO_ARQUIVO` pelo arquivo que deseja incluir e repita para outros arquivos, se necessário. Abra um Pull Request no GitHub para revisão. Acesso de leitura ao repositório não concede automaticamente permissão de envio; solicite essa permissão à responsável pelo projeto.

## Desenvolvimento com Lovable

Este projeto foi criado com [Lovable](https://lovable.dev) e está conectado ao [editor do projeto](https://lovable.dev/projects/e25b4b4b-ca45-49cf-ab26-954dbe20c3fc). Alterações enviadas à branch conectada são sincronizadas com o editor. Preserve o histórico publicado: não use force push nem reescreva commits já enviados. Consulte [AGENTS.md](AGENTS.md) para as orientações de desenvolvimento.

Para ativar o chat e a integração com Gemini (Google), siga o [guia do chat](supabase/CHAT_SETUP.md). A chave fica nos Secrets das Edge Functions, nunca nas variáveis públicas do frontend.

### Condições comerciais do assistente

Administradores acessam /condicoes-comerciais pelo menu da conta para cadastrar e revisar preços, entrada, parcelamento, juros e formas de pagamento por região. Apenas condições aprovadas são disponibilizadas à IA. Rascunhos e preços ilustrativos não são usados como propostas.

Aplique [202611090002_commercial_terms.sql](supabase/migrations/202611090002_commercial_terms.sql) depois da migração do chat e publique a versão atualizada da Edge Function. O [guia do chat](supabase/CHAT_SETUP.md) detalha a ativação. A equipe acompanha as conversas em /chat e usa **Interromper IA e assumir** para continuar o atendimento humano.
### Especialista de Marte

Em /inicio, **Falar com especialista** abre o diálogo com Gemini sobre clima, temperaturas, condições atmosféricas, tempo marciano e relevo, com referências da NASA e indicação de ausência de previsão em tempo real. O usuário precisa entrar na conta e pode conversar sem ter uma reserva. A ativação requer a nova [migração de limite de uso](supabase/migrations/202611090003_mars_specialist.sql) e a publicação dos arquivos atualizados, conforme o [guia](supabase/CHAT_SETUP.md).