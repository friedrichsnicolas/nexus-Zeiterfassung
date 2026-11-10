-- Run once in the dedicated Zeitwerk Supabase project SQL editor.
-- Data is private per auth.uid(); no anonymous access, no frontend service key.
begin;
create table if not exists public.zeitwerk_documents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version bigint not null check (version > 0),
  body jsonb not null check (jsonb_typeof(body) = 'object'),
  operation_id uuid not null,
  updated_at timestamptz not null default now()
);
alter table public.zeitwerk_documents enable row level security;
revoke all on public.zeitwerk_documents from anon, authenticated;
grant select on public.zeitwerk_documents to authenticated;
drop policy if exists zeitwerk_read_own on public.zeitwerk_documents;
create policy zeitwerk_read_own on public.zeitwerk_documents
 for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.zeitwerk_write(p_expected bigint, p_body jsonb, p_operation uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_doc public.zeitwerk_documents%rowtype;
begin
 if v_uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_expected is null or p_expected < 0 or p_operation is null or p_body is null
    or jsonb_typeof(p_body) is distinct from 'object'
    or jsonb_typeof(p_body->'state') is distinct from 'object'
    or jsonb_typeof(p_body->'state'->'entries') is distinct from 'array'
    or jsonb_typeof(p_body->'state'->'projects') is distinct from 'array'
    or jsonb_typeof(p_body->'state'->'places') is distinct from 'array'
    or octet_length(p_body::text)>10000000 then
   raise exception 'Invalid Zeitwerk document';
 end if;
 -- Serializes writes for one account, including the initial insert.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text,0));
 select * into v_doc from public.zeitwerk_documents where user_id=v_uid;
 if found then
   if v_doc.operation_id=p_operation then
     return jsonb_build_object('ok',true,'version',v_doc.version);
   end if;
   if v_doc.version<>p_expected then return jsonb_build_object('ok',false,'conflict',true); end if;
   update public.zeitwerk_documents set body=p_body,version=version+1,operation_id=p_operation,updated_at=now()
    where user_id=v_uid returning * into v_doc;
 else
   if p_expected<>0 then return jsonb_build_object('ok',false,'conflict',true); end if;
   insert into public.zeitwerk_documents(user_id,version,body,operation_id)
    values(v_uid,1,p_body,p_operation) returning * into v_doc;
 end if;
 return jsonb_build_object('ok',true,'version',v_doc.version);
end $$;
revoke all on function public.zeitwerk_write(bigint,jsonb,uuid) from public,anon;
grant execute on function public.zeitwerk_write(bigint,jsonb,uuid) to authenticated;
commit;
