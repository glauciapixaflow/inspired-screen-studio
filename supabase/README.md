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

O botão de confirmação ficará para um futuro painel da equipe. Até lá, somente o administrador pode registrar o contato pelo Supabase, alterando o status para `contacted` na tabela `area_reservations`. O banco preenche `contacted_at`, exige que o contato seja confirmado antes do vencimento e mantém essa reserva ativa para negociação. O usuário não pode confirmar o próprio contato nem alterar sua reserva. A presença de um contato fora do sistema não é detectada automaticamente: a equipe precisa registrá-lo antes do prazo.

Exemplo no SQL Editor, substituindo o protocolo real:

```sql
update public.area_reservations
set status = 'contacted'
where id = 'COLE-O-PROTOCOLO-UUID-AQUI'
  and status = 'pending_contact';
```

Uma reserva já vencida não pode ser reativada por essa confirmação; o interessado pode solicitar novamente se a parcela estiver disponível. Não há envio automático de mensagens ou canal de contato configurado nesta versão.

## Acesso

RLS permite consultar apenas as próprias reservas. Usuários autenticados só podem inserir região e parcela; o banco fornece proprietário, protocolo, status e datas. Visitantes não recebem acesso. Alterações e exclusões pelo cliente são bloqueadas. A view usa `security_invoker`, preservando RLS. As visualizações 3D de construção continuam sendo simulações locais.

## Verificação

- `npm test`, `npx tsc --noEmit`, `npm run build`.
- `tests/area_reservations.sql` verifica isolamento, permissões e duplicatas no SQL Editor.
- `tests/reservation_deadline.sql` verifica 120 horas, liberação de parcela vencida, histórico e confirmação de contato.
- Os testes SQL usam uma transação com usuários temporários e terminam em ROLLBACK. Nenhum teste SQL foi executado automaticamente no projeto remoto.
