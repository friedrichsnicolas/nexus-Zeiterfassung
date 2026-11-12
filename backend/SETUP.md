# Zeitwerk Cloud aktivieren

Die App enthält die Anbindung; eine leere `sync-config.js` aktiviert keine Cloud und überträgt keine Zeitdaten. Supabase muss tatsächlich eingerichtet und geprüft werden.

1. Dediziertes Supabase-Projekt anlegen (Region Frankfurt/EU, sofern verfügbar); Tarif und Kosten vor Erstellung prüfen.
2. `backend/setup.sql` im SQL Editor ausführen. Die Tabelle hat RLS, nur eigene Zeilen sind lesbar. Schreibzugriffe sind ausschließlich über die authentifizierte, versionsgeprüfte Funktion möglich. Keine anonymen Tabellen-/Funktionsrechte.
3. Authentication → URL Configuration: Site URL und erlaubte Redirect URL auf `https://friedrichsnicolas.github.io/nexus-Zeiterfassung/` setzen.
4. E-Mail-Anmeldung aktivieren, öffentliche Neuregistrierungen deaktivieren. Den persönlichen Benutzer in Authentication → Users anlegen/einladen. Die App verwendet `shouldCreateUser:false`. Gegebenenfalls eigenen SMTP-Versand einrichten; den realen Linkversand prüfen.
5. In `sync-config.js` ausschließlich Projekt-URL und öffentlichen Publishable-/anon-Schlüssel einsetzen. Diese Werte dürfen im statischen App-Code stehen. Niemals service_role, Datenbankpasswort, Personal Access Token oder `sb_secret_...` veröffentlichen.
6. Deployment abwarten, auf jedem Gerät mit derselben E-Mail anmelden. Link auf dem jeweiligen Gerät öffnen. Alternativ kann die öffentliche Verbindung lokal unter Konto & Sync konfiguriert werden.
7. Vor der ersten Übernahme auf allen vorhandenen Geräten eine JSON-Sicherung erstellen. Bei abweichenden Ständen wählt der Benutzer bewusst einen Stand. Es gibt kein automatisches Zusammenführen paralleler Änderungen.
8. Vor Freigabe mit zwei Benutzern/Clients überprüfen: anonymes Lesen/Schreiben wird verweigert, Benutzer A sieht Benutzer B nicht; veraltete Versionen führen zu einem Konflikt. Anschließend mit zwei Geräten und demselben echten Konto: Stempelvorgang starten/stoppen, Urlaub ändern, offline arbeiten und wieder verbinden.

## Verhalten

- Abgleich bei geöffneter, sichtbarer App ca. alle 12 Sekunden und nach Änderungen/erneutem Fokus.
- Lokale Änderungen werden vor dem Upload gespeichert. Bei Netzfehlern bleibt die Operation inklusive eindeutiger ID erhalten.
- Ein atomarer Versionsvergleich verhindert stilles Überschreiben. Bei Konflikten werden die Datenstände nicht automatisch zusammengeführt; manuelle Auswahl mit lokaler Wiederherstellungskopie.
- Vor dem Ersetzen werden Wiederherstellungskopien lokal gespeichert. Gerätestand und Cloud-Sicherungsformat `{state, clock}` können über den JSON-Import geladen werden; alte State-only-Sicherungen bleiben kompatibel.
- Nach Abmeldung bleiben Gerätedaten erhalten. Bei einem Kontowechsel werden diese nicht automatisch in das andere Konto hochgeladen.
- Das persönliche Backend wurde erst dann live verifiziert, wenn Projekt, SQL, Auth-Konfiguration, Login-Versand und Tests tatsächlich abgeschlossen wurden.

## Bibliothek

`supabase-sdk.js`: offizielles UMD-Bundle `@supabase/supabase-js` 2.119.0, heruntergeladen von jsDelivr am 10.11.2026. MIT-Lizenz siehe `SUPABASE-LICENSE`. Die App lädt die lokale Kopie nur bei konfigurierter Cloud.

## Siri und CarPlay (Stempeluhr per Kurzbefehl)

Optional. Damit lässt sich die Stempeluhr per iOS-Kurzbefehl und Siri starten und stoppen, auch über CarPlay und bei gesperrtem iPhone.

1. `backend/siri-kurzbefehl.sql` einmalig im SQL Editor ausführen (nach `setup.sql`). Das Skript ist rein additiv und wiederholbar.
2. In Zeitwerk unter Konto & Sync → Siri & CarPlay einen Schlüssel erstellen und die angezeigten Schritte in der App Kurzbefehle durchführen.

Sicherheit: In der Datenbank liegt nur der SHA-256-Wert des Schlüssels. `public.zeitwerk_stempel` ist mit dem öffentlichen App-Schlüssel (Rolle `anon`) aufrufbar, wirkt aber nur mit gültigem persönlichem Schlüssel und ändert ausschließlich `body.clock` des eigenen Dokuments. Jeder Aufruf erhöht die Version wie ein normaler Schreibvorgang, sodass geöffnete Geräte den neuen Stand per Realtime übernehmen und veraltete Stände einen Konflikt statt eines stillen Überschreibens erhalten. Zeiteinträge werden weder gelesen noch zurückgegeben. Ein neuer Schlüssel ersetzt den alten; Löschen sperrt alle Kurzbefehle.

Prüfung: `PGHOST=… PGUSER=… tests/stempel-sql.sh` führt die Funktionen gegen eine lokale PostgreSQL-Datenbank mit nachgebildeten Supabase-Rollen aus.
