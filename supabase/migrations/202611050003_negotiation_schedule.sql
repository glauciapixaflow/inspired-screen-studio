-- Run after 202611050002_negotiation_resolution.sql in the Supabase SQL Editor.
-- Records expired negotiations automatically, including while the website is closed.
begin;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'expire-reservation-negotiations',
  '* * * * *',
  'select public.expire_negotiation_reservations();'
);
commit;
