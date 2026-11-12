-- Zeitwerk: Stempeluhr per Siri-Kurzbefehl (auch über CarPlay) steuern.
-- Einmalig im SQL Editor des Zeitwerk-Supabase-Projekts ausführen, NACH backend/setup.sql.
-- Rein additiv: legt eine neue private Tabelle und vier Funktionen an, ändert keine bestehenden Daten.
-- Rückbau: siehe Ende dieser Datei.
--
-- Prinzip: In der App erzeugt die angemeldete Person einen persönlichen Kurzbefehl-Schlüssel.
-- In der Datenbank liegt nur sein SHA-256-Wert. Ein iOS-Kurzbefehl ruft mit diesem Schlüssel
-- public.zeitwerk_stempel(...) auf. Die Funktion ändert ausschließlich den Stempelstatus (body.clock)
-- des zugehörigen Kontos, erhöht die Version wie jeder andere Schreibvorgang und antwortet mit
-- einem Satz, den Siri vorliest. Zeiteinträge, Projekte, Urlaub und Einstellungen bleiben unberührt.
begin;

create schema if not exists zeitwerk_private;

create table if not exists zeitwerk_private.shortcut_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  key_hash bytea not null unique,
  time_zone text not null default 'Europe/Berlin',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table zeitwerk_private.shortcut_keys enable row level security;
revoke all on zeitwerk_private.shortcut_keys from public, anon, authenticated;

-- Dauer als gesprochener Text, z. B. "2 Stunden 5 Minuten".
create or replace function zeitwerk_private.spoken_duration(p_ms bigint)
returns text language sql immutable set search_path = '' as $$
 select case
  when greatest(p_ms,0) < 60000 then 'weniger als eine Minute'
  else concat_ws(' ',
   case when greatest(p_ms,0)/3600000 = 1 then '1 Stunde'
        when greatest(p_ms,0)/3600000 > 1 then (greatest(p_ms,0)/3600000)::text || ' Stunden' end,
   case when (greatest(p_ms,0)/60000) % 60 = 1 then '1 Minute'
        when (greatest(p_ms,0)/60000) % 60 > 1 then ((greatest(p_ms,0)/60000) % 60)::text || ' Minuten' end)
 end;
$$;
revoke all on function zeitwerk_private.spoken_duration(bigint) from public, anon;

-- Neuer Schlüssel für die angemeldete Person. Ersetzt einen vorhandenen Schlüssel.
-- Der Klartext wird nur hier einmal zurückgegeben und nirgends gespeichert.
create or replace function public.zeitwerk_kurzbefehl_schluessel(p_time_zone text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_key text; v_tz text := 'Europe/Berlin';
begin
 if v_uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_time_zone is not null and exists(select 1 from pg_catalog.pg_timezone_names where name = p_time_zone) then
   v_tz := p_time_zone;
 end if;
 -- 244 Zufallsbits aus dem kryptografischen Zufallsgenerator der Datenbank.
 v_key := 'zw_' || replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
 insert into zeitwerk_private.shortcut_keys(user_id,key_hash,time_zone)
  values (v_uid, sha256(convert_to(v_key,'UTF8')), v_tz)
  on conflict (user_id) do update set key_hash = excluded.key_hash, time_zone = excluded.time_zone,
   created_at = now(), last_used_at = null;
 return v_key;
end $$;
revoke all on function public.zeitwerk_kurzbefehl_schluessel(text) from public, anon;
grant execute on function public.zeitwerk_kurzbefehl_schluessel(text) to authenticated;

-- Status des eigenen Schlüssels, ohne den Schlüssel selbst.
create or replace function public.zeitwerk_kurzbefehl_info()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_row zeitwerk_private.shortcut_keys%rowtype;
begin
 if v_uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into v_row from zeitwerk_private.shortcut_keys where user_id = v_uid;
 if not found then return jsonb_build_object('vorhanden',false); end if;
 return jsonb_build_object('vorhanden',true,'erstellt',v_row.created_at,'zuletzt_genutzt',v_row.last_used_at);
end $$;
revoke all on function public.zeitwerk_kurzbefehl_info() from public, anon;
grant execute on function public.zeitwerk_kurzbefehl_info() to authenticated;

-- Eigenen Schlüssel löschen. Bestehende Kurzbefehle funktionieren danach nicht mehr.
create or replace function public.zeitwerk_kurzbefehl_widerrufen()
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
 if v_uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 delete from zeitwerk_private.shortcut_keys where user_id = v_uid;
 return found;
end $$;
revoke all on function public.zeitwerk_kurzbefehl_widerrufen() from public, anon;
grant execute on function public.zeitwerk_kurzbefehl_widerrufen() to authenticated;

-- Einstempeln, Ausstempeln oder Status abfragen. Aufrufbar mit dem öffentlichen Schlüssel der App
-- (Rolle anon); berechtigt ist ausschließlich, wer den persönlichen Kurzbefehl-Schlüssel kennt.
create or replace function public.zeitwerk_stempel(p_schluessel text, p_aktion text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_key zeitwerk_private.shortcut_keys%rowtype;
 v_doc public.zeitwerk_documents%rowtype;
 v_action text := lower(trim(coalesce(p_aktion,'')));
 v_clock jsonb; v_next jsonb; v_now_ms bigint; v_local text; v_start_ms bigint; v_end text;
 v_msg text; v_ok boolean := true; v_changed boolean := false;
begin
 if p_schluessel is null or length(p_schluessel) not between 20 and 200 then
   return jsonb_build_object('ok',false,'nachricht','Der Kurzbefehl hat keinen gültigen Schlüssel. Bitte in Zeitwerk unter Konto und Sync einen neuen Schlüssel erstellen.');
 end if;
 select * into v_key from zeitwerk_private.shortcut_keys where key_hash = sha256(convert_to(p_schluessel,'UTF8'));
 if not found then
   return jsonb_build_object('ok',false,'nachricht','Der Kurzbefehl-Schlüssel ist ungültig oder wurde ersetzt. Bitte in Zeitwerk unter Konto und Sync einen neuen Schlüssel erstellen.');
 end if;

 v_action := case
  when v_action in ('ein','start','starten','einstempeln','in') then 'ein'
  when v_action in ('aus','stop','stopp','stoppen','ausstempeln','out') then 'aus'
  when v_action in ('status','stand','info','') then 'status'
  else null end;
 if v_action is null then
   return jsonb_build_object('ok',false,'nachricht','Unbekannte Aktion. Erlaubt sind ein, aus und status.');
 end if;

 -- Gleiche Sperre wie zeitwerk_write: Schreibvorgänge eines Kontos laufen nacheinander.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key.user_id::text,0));
 update zeitwerk_private.shortcut_keys set last_used_at = now() where user_id = v_key.user_id;
 select * into v_doc from public.zeitwerk_documents where user_id = v_key.user_id for update;
 if not found then
   return jsonb_build_object('ok',false,'nachricht','Für dieses Konto gibt es noch keine Cloud-Daten. Bitte Zeitwerk einmal angemeldet öffnen.');
 end if;

 v_clock := v_doc.body->'clock';
 if v_clock is not null and jsonb_typeof(v_clock) <> 'object' then v_clock := null; end if;
 v_now_ms := floor(extract(epoch from now())*1000)::bigint;
 v_local := to_char(now() at time zone v_key.time_zone, 'YYYY-MM-DD"T"HH24:MI');
 if v_clock is not null then
   v_start_ms := case when jsonb_typeof(v_clock->'startedAt') = 'number' then (v_clock->>'startedAt')::numeric::bigint
     else floor(extract(epoch from ((v_clock->>'start')::timestamp at time zone v_key.time_zone))*1000)::bigint end;
 end if;

 if v_action = 'ein' then
   if v_clock is not null and jsonb_typeof(v_clock->'end') = 'string' then
     v_ok := false;
     v_msg := 'Der letzte Vorgang ist noch offen. Bitte in Zeitwerk Projekt und Arbeitsort ergänzen, danach kannst du wieder einstempeln.';
   elsif v_clock is not null then
     v_msg := 'Die Stempeluhr läuft bereits seit ' || substr(v_clock->>'start',12,5) || ' Uhr.';
   else
     v_next := jsonb_build_object('id',gen_random_uuid()::text,'start',v_local,'startedAt',v_now_ms,'end',null);
     v_msg := 'Eingestempelt um ' || substr(v_local,12,5) || ' Uhr.';
   end if;
 elsif v_action = 'aus' then
   if v_clock is null then
     v_ok := false;
     v_msg := 'Die Stempeluhr läuft gerade nicht.';
   elsif jsonb_typeof(v_clock->'end') = 'string' then
     v_msg := 'Bereits ausgestempelt um ' || substr(v_clock->>'end',12,5) || ' Uhr. Projekt und Arbeitsort ergänzt du in Zeitwerk.';
   else
     -- Beim Zeitumstellen zurück darf das Ende nicht vor dem Beginn liegen.
     v_end := greatest(v_local, v_clock->>'start');
     v_next := v_clock || jsonb_build_object('end',v_end,'stoppedAt',greatest(v_now_ms,v_start_ms));
     v_msg := 'Ausgestempelt um ' || substr(v_local,12,5) || ' Uhr. Erfasste Zeit: '
       || zeitwerk_private.spoken_duration(v_now_ms - v_start_ms) || '. Projekt und Arbeitsort ergänzt du später in Zeitwerk.';
   end if;
 else
   if v_clock is null then
     v_msg := 'Die Stempeluhr ist bereit. Du bist gerade nicht eingestempelt.';
   elsif jsonb_typeof(v_clock->'end') = 'string' then
     v_msg := 'Ausgestempelt um ' || substr(v_clock->>'end',12,5) || ' Uhr. Projekt und Arbeitsort sind noch offen.';
   else
     v_msg := 'Die Stempeluhr läuft seit ' || substr(v_clock->>'start',12,5) || ' Uhr, bisher '
       || zeitwerk_private.spoken_duration(v_now_ms - v_start_ms) || '.';
   end if;
 end if;

 if v_next is not null then
   update public.zeitwerk_documents
     set body = jsonb_set(body,'{clock}',v_next,true), version = version + 1,
         operation_id = gen_random_uuid(), updated_at = now()
     where user_id = v_key.user_id returning * into v_doc;
   v_changed := true;
 end if;
 return jsonb_build_object('ok',v_ok,'aktion',v_action,'geaendert',v_changed,'nachricht',v_msg,'version',v_doc.version);
end $$;
revoke all on function public.zeitwerk_stempel(text,text) from public;
grant execute on function public.zeitwerk_stempel(text,text) to anon, authenticated;
commit;

-- Rückbau (bei Bedarf, löscht nur die Kurzbefehl-Schlüssel, keine Zeitdaten):
-- drop function if exists public.zeitwerk_stempel(text,text);
-- drop function if exists public.zeitwerk_kurzbefehl_widerrufen();
-- drop function if exists public.zeitwerk_kurzbefehl_info();
-- drop function if exists public.zeitwerk_kurzbefehl_schluessel(text);
-- drop function if exists zeitwerk_private.spoken_duration(bigint);
-- drop table if exists zeitwerk_private.shortcut_keys;
