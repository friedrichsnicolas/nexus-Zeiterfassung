#!/usr/bin/env bash
# Prüft backend/siri-kurzbefehl.sql gegen eine lokale PostgreSQL-Datenbank mit nachgebildeten
# Supabase-Rollen (anon, authenticated) und auth.uid(). Kein Teil von `npm test`, weil CI keine
# Datenbank startet. Aufruf: PGHOST=... PGUSER=... tests/stempel-sql.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=zeitwerk_stempel_test
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
q(){ psql -X -q -t -A -v ON_ERROR_STOP=1 -d $DB "$@"; }
fail(){ echo "FAIL $1"; exit 1; }
q <<'SQL'
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
insert into auth.users values ('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222');
SQL
q -f backend/setup.sql >/dev/null
q -f backend/siri-kurzbefehl.sql >/dev/null
q -f backend/siri-kurzbefehl.sql >/dev/null # wiederholbar
A=11111111-1111-1111-1111-111111111111
as_user(){ q -c "set role authenticated; set request.jwt.claim.sub='$1';" -c "$2"; }
as_anon(){ q -c "set role anon; set request.jwt.claim.sub='';" -c "$1"; }
body='{"state":{"entries":[{"id":"e1"}],"projects":["neXus intern"],"places":[]},"clock":null}'
as_user $A "select zeitwerk_write(0,'$body'::jsonb,gen_random_uuid())" >/dev/null

[[ $(as_anon "select zeitwerk_stempel('zw_'||repeat('a',64),'ein')->>'ok'") == false ]] || fail "Unbekannter Schlüssel wird abgelehnt"
echo "PASS Unbekannter Schlüssel wird abgelehnt"
if as_anon "select zeitwerk_kurzbefehl_schluessel('Europe/Berlin')" 2>/dev/null; then fail "anon darf keinen Schlüssel erzeugen"; fi
if as_anon "select * from zeitwerk_private.shortcut_keys" 2>/dev/null; then fail "anon liest Schlüsseltabelle"; fi
if as_user $A "select * from zeitwerk_private.shortcut_keys" 2>/dev/null; then fail "authenticated liest Schlüsseltabelle"; fi
echo "PASS Schlüssel lassen sich nicht anonym erzeugen, und die Schlüsseltabelle ist nicht lesbar"
KEY=$(as_user $A "select zeitwerk_kurzbefehl_schluessel('Europe/Berlin')")
[[ $KEY =~ ^zw_[0-9a-f]{64}$ ]] || fail "Schlüsselformat"
[[ $(q -c "select count(*) from zeitwerk_private.shortcut_keys where key_hash::text like '%$KEY%'") == 0 ]] || fail "Klartext gespeichert"
[[ $(as_user $A "select zeitwerk_kurzbefehl_info()->>'vorhanden'") == true ]] || fail "Info"
echo "PASS Schlüssel wird erzeugt und nur als SHA-256 gespeichert"

R=$(as_anon "select zeitwerk_stempel('$KEY','status')")
[[ $R == *'ist bereit'* ]] || fail "Status bereit: $R"
R=$(as_anon "select zeitwerk_stempel('$KEY','Ein')")
[[ $(jq -r .geaendert <<<"$R") == true && $(jq -r .version <<<"$R") == 2 && $R == *Eingestempelt* ]] || fail "Einstempeln: $R"
q -c "select body->'clock' from zeitwerk_documents" | jq -e '(.id|type)=="string" and (.start|test("^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d$")) and (.startedAt|type)=="number" and .end==null' >/dev/null || fail "Clock-Format"
[[ $(q -c "select body->'state'->'entries'->0->>'id' from zeitwerk_documents") == e1 ]] || fail "Zeiteinträge unverändert"
echo "PASS Einstempeln setzt einen app-kompatiblen Stempelstatus, erhöht die Version und lässt Einträge unberührt"
R=$(as_anon "select zeitwerk_stempel('$KEY','start')")
[[ $(jq -r .geaendert <<<"$R") == false && $R == *'läuft bereits'* ]] || fail "Doppelt ein: $R"
echo "PASS Doppeltes Einstempeln ändert nichts"
q -c "update zeitwerk_documents set body=jsonb_set(body,'{clock,startedAt}',to_jsonb(floor(extract(epoch from now()-interval '2 hours 5 minutes')*1000)::bigint))"
R=$(as_anon "select zeitwerk_stempel('$KEY','status')")
[[ $R == *'2 Stunden 5 Minuten'* ]] || fail "Status läuft: $R"
R=$(as_anon "select zeitwerk_stempel('$KEY','stopp')")
[[ $(jq -r .version <<<"$R") == 3 && $R == *'Erfasste Zeit: 2 Stunden 5 Minuten'* ]] || fail "Ausstempeln: $R"
q -c "select body->'clock' from zeitwerk_documents" | jq -e '(.end|type)=="string" and .end>=.start and (.stoppedAt|type)=="number"' >/dev/null || fail "Clock nach Stopp"
echo "PASS Ausstempeln beendet den Vorgang und nennt die Dauer"
R=$(as_anon "select zeitwerk_stempel('$KEY','ein')")
[[ $(jq -r .ok <<<"$R") == false && $(jq -r .geaendert <<<"$R") == false ]] || fail "Ein bei offenem Abschluss: $R"
echo "PASS Neues Einstempeln wartet, bis der letzte Vorgang in der App ergänzt ist"
[[ $(as_anon "select zeitwerk_stempel('$KEY','tanzen')->>'ok'") == false ]] || fail "Unbekannte Aktion"
echo "PASS Unbekannte Aktion wird abgelehnt"
# Ein vom Client geschriebener Stand mit veralteter Version erzeugt weiterhin einen Konflikt.
[[ $(as_user $A "select zeitwerk_write(2,'$body'::jsonb,gen_random_uuid())->>'conflict'") == true ]] || fail "Konflikt"
echo "PASS Veraltete Geräte bekommen nach einem Kurzbefehl einen Konflikt statt stillem Überschreiben"
NEW=$(as_user $A "select zeitwerk_kurzbefehl_schluessel('Kein/Zeitzone')")
[[ $(as_anon "select zeitwerk_stempel('$KEY','status')->>'ok'") == false ]] || fail "Alter Schlüssel noch gültig"
[[ $(q -c "select time_zone from zeitwerk_private.shortcut_keys") == Europe/Berlin ]] || fail "Zeitzonen-Rückfall"
[[ $(as_user $A "select zeitwerk_kurzbefehl_widerrufen()") == t ]] || fail "Widerruf"
[[ $(as_anon "select zeitwerk_stempel('$NEW','status')->>'ok'") == false ]] || fail "Widerrufener Schlüssel"
echo "PASS Neuer Schlüssel ersetzt den alten, ungültige Zeitzonen fallen auf Europe/Berlin zurück, Widerruf sperrt"
B=22222222-2222-2222-2222-222222222222
KB=$(as_user $B "select zeitwerk_kurzbefehl_schluessel('Europe/Berlin')")
[[ $(as_anon "select zeitwerk_stempel('$KB','ein')") == *'noch keine Cloud-Daten'* ]] || fail "Ohne Dokument"
[[ $(q -c "select count(*) from zeitwerk_documents") == 1 ]] || fail "Fremdes Dokument verändert"
echo "PASS Ein Schlüssel wirkt nur auf das eigene Konto"
psql -q -d postgres -c "drop database $DB" >/dev/null
