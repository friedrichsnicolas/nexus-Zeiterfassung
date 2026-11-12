# Zeitwerk – persönliche Projekt- und Arbeitszeiterfassung

Responsive Web-App ohne Build-Schritt mit optionaler privater Supabase-Synchronisierung. Unterstützt Desktop, iPhone und iPad im Browser.

## Funktionen
- Arbeitszeit und Reisezeit, Start/Ende mit Datum, Pausen und Nettozeit
- Remote oder Vor Ort mit optionaler Ortsauswahl und Freitext
- Projekte und Orte verwalten; alte Einträge bleiben beim Entfernen erhalten
- Zeiteinträge bearbeiten/löschen, Überschneidungen verhindern
- Dashboard nach Zeitraum und Projekt; Summen und Projektübersicht
- Excel-kompatibler SpreadsheetML-Export (.xml), numerische Stundenwerte
- PDF über den Druckdialog des Browsers („Als PDF sichern“)
- JSON-Sicherung und Wiederherstellung

## GitHub Pages
1. Repository: `friedrichsnicolas/nexus-Zeiterfassung`.
2. Alle Dateien dieses Ordners inklusive `.github/workflows/pages.yml` hochladen.
3. Unter Settings → Pages → Source **GitHub Actions** auswählen.
4. Der Workflow deployt die App nach jedem Push auf `main`. Den Link zeigt der erfolgreiche Workflow unter `github-pages`.

Alternativ: Settings → Pages → Deploy from a branch → main → / (root). Dann ist der Workflow nicht erforderlich.

## Daten und Grenzen
Die App speichert Zeitdaten sofort lokal im Browser. Nach Anmeldung werden sie automatisch mit dem privaten Supabase-Konto abgeglichen. Ohne Internet bleiben Änderungen lokal vorgemerkt. Regelmäßig JSON-Sicherungen erstellen; beim Löschen von Browserdaten können noch nicht synchronisierte Änderungen verloren gehen. GitHub Pages veröffentlicht ausschließlich den App-Code. Persönliche Einträge werden nicht ins Repository geschrieben.

Das Dashboard ordnet einen Eintrag vollständig seinem Startdatum zu, auch wenn er über Mitternacht reicht. Reisezeit wird separat gezählt; die Gesamtsumme ist Arbeitszeit plus Reisezeit. Keine automatische rechtliche oder vergütungsbezogene Bewertung. Start-/Endzeit werden in der lokalen Zeitzone des Geräts interpretiert.

## Lokal öffnen
`index.html` öffnen oder im Ordner `python3 -m http.server 8080` ausführen. Für eine stabile Speicherung dieselbe URL verwenden.


## Erweiterungen
- Tagesübersicht mit chronologischen Zeitblöcken, Tageswechsel und Wochenfortschritt
- Persönliches Wochenziel (Standard 40 Stunden), wahlweise inklusive Reisezeit; in JSON-Sicherungen enthalten
- Jahresauswertung mit zwölf Monatszeilen und Vergleich nach Projekt und Arbeitsort
- Zusätzliche Dashboard-Filter nach Zeitart, Arbeitsort und Volltext (Projekt/Ort/Notiz); alle Dashboard-Exporte berücksichtigen diese Filter
- CSV-Export mit Semikolon und Dezimalkomma; Schutz vor Formelinterpretation von Textwerten

Das Wochenziel ist ein persönlicher Vergleichswert. Urlaub und Feiertage werden nicht automatisch berücksichtigt. Alle Auswertungen ordnen die gesamte Nettozeit dem Startdatum des Eintrags zu. PDF-Ausgabe bezieht sich auf das Dashboard.

## Urlaubstracker
Eigene Seite mit Jahresanspruch, manuellem Übertrag, verbrauchten und geplanten Tagen sowie frei verfügbarem Rest. Ganze Tage und einzelne halbe Tage; Wochenenden und gesetzliche NRW-Feiertage werden ausgeschlossen. Die elf regelmäßig geltenden gesetzlichen NRW-Feiertage werden automatisch für das jeweilige Jahr berechnet und von Urlaubstagen ausgenommen. Andere freie Tage können zusätzlich pro Jahr manuell hinterlegt werden. Vergangene Einträge einschließlich heute gelten als verbraucht, künftige Tage als reserviert. Es gibt keine Genehmigungsverwaltung. Jahresübergreifende Zeiträume werden für jedes Jahr separat gezählt. Urlaub, Ansprüche und freie Tage sind in den JSON-Sicherungen enthalten. Der Tracker verändert das persönliche Wochenziel nicht automatisch.


## Urlaubseinstellungen und Monatskalender
Jahresanspruch, manuelle Übertragshöhe, optionales Verfallsdatum (im jeweiligen Jahr) und zusätzliche freie Tage werden unter Einstellungen je Kalenderjahr gepflegt. Ohne Verfallsdatum bleibt der Übertrag im Konto erhalten. Urlaub wird chronologisch zuerst auf noch gültigen Übertrag angerechnet; nach Ablauf wird der ungenutzte Anteil als verfallen ausgewiesen und vom frei verfügbaren Rest abgezogen. Dies bildet die selbst konfigurierte Regel ab, keine automatische arbeitsrechtliche Prüfung.

Die Urlaubsseite zeigt eine Monatsansicht: Urlaub in Salbeigrün, NRW-Feiertage in Messing und Projekt-/Ortsangaben in Grün-Grau. Ein Klick auf ein Datum öffnet alle Details und die Bearbeitung vorhandener Zeiteinträge. Wochenend- und Feiertage innerhalb eines Urlaubszeitraums sind als ohne Abzug gekennzeichnet. Über Mitternacht laufende Projekte erscheinen an den betroffenen Tagen, ein Ende genau um 00:00 nicht zusätzlich am Folgetag. Alle Einstellungen sind Teil der JSON-Sicherung.



## Geräteübergreifende Synchronisierung
Die Seite Konto & Sync enthält Anmeldung per E-Mail-Link, Datenübernahme und Konfliktauswahl. Das persönliche Supabase-Projekt ist eingerichtet und über den öffentlichen Schlüssel in `sync-config.js` verbunden. Ohne Konfiguration arbeitet die App ausschließlich lokal weiter.

Siehe [backend/SETUP.md](backend/SETUP.md) und [backend/setup.sql](backend/setup.sql) für die konkrete Einrichtung und die erforderlichen Live-Prüfungen. Daten, Stempelstatus und Urlaubs-/Projekteinstellungen werden als private, versionsgeprüfte Dokumente je Benutzer gespeichert. Gleichzeitige Änderungen erfordern eine bewusste Auswahl; sie werden nicht automatisch zusammengeführt. Offline-Änderungen bleiben lokal vorgemerkt.

Das Browser-SDK wird lokal ausgeliefert (Version 2.119.0, MIT, `SUPABASE-LICENSE`). `node tests/sync.cjs` prüft den clientseitigen Konflikt-/Wiederholungsablauf mit simuliertem Backend; dies ersetzt keinen Live-Test der Datenbank, RLS-Regeln und E-Mail-Anmeldung.

## Entwicklung und Qualitätssicherung

`npm ci --ignore-scripts` installiert ausschließlich Entwicklungsabhängigkeiten. `npm test` prüft Berechnungen, Sync-Rennen und die vollständigen Anwendungsabläufe in einem isolierten DOM. Die produktive App benötigt keine npm-Pakete im Browser. Der GitHub-Workflow prüft die App und veröffentlicht nur die benötigten statischen Dateien. Details und Prüfgrenzen: [QA.md](QA.md).

Die Oberfläche verwendet ein eigenständiges Zeitwerk-Zeichen, Dunkelgrün, warme helle Flächen und Messingakzente. Der Cloud-Status ist dauerhaft im Kopf erreichbar. Bereits ausgestempelte Vorgänge werden zum Ergänzen der Randdaten automatisch wiederhergestellt. Während eines Cloud-Abgleichs und offener Konflikte bleibt lokales Erfassen möglich. Bei abweichenden Datenständen wird die Cloud erst nach bewusster Auswahl weitergeschrieben.

## Gemeinsame Stempeluhr

Auf jedem Gerät unter Konto & Sync mit derselben E-Mail-Adresse anmelden. Den E-Mail-Link im Browser öffnen, in dem die App verwendet wird. Die Stempeluhr zeigt eine fehlende Anmeldung ausdrücklich an; lokale Buchungen ohne Anmeldung werden nicht auf andere Geräte übertragen.

Angemeldete Geräte empfangen Änderungen per Supabase Postgres Changes für die eigene Benutzerzeile. Ein Kontrollabgleich alle drei Sekunden bei sichtbarer App und ein sofortiger Abgleich nach Fokus/Netzrückkehr sichern die Wiederaufnahme. Offene Formulare blockieren reine Timer-Updates nicht. Ein gespeicherter gemeinsamer Ausgangsstand ermöglicht das sichere Zusammenführen voneinander unabhängiger Änderungen an Stempeluhr und Stammdaten; uneindeutige Änderungen bleiben eine bewusste Konfliktauswahl.

`tests/devices.cjs` führt den vollständigen Ablauf Computer → Handy → Computer in zwei getrennten DOM-Laufzeiten mit eigenem localStorage, echter App-/Sync-Logik und einem gemeinsamen, versionsgeprüften Testtransport aus. Dazu gehören erhaltene Eingabeentwürfe, Rückfall auf Polling, Abschluss auf dem anderen Gerät und konkurrierende Änderungen. Es ist kein physischer Zwei-Geräte-Livetest.

## Kontoverwaltung und Passwort-Anmeldung

Unter Konto & Sync kann eine bereits angemeldete Person selbst ein Passwort festlegen oder ändern (mindestens zwölf Zeichen), ihre Kontoadresse und letzte Anmeldung sehen sowie andere Sitzungen abmelden. Auf weiteren Geräten ist anschließend die Anmeldung mit E-Mail und Passwort ohne neue Anmelde-E-Mail möglich. Passwörter werden ausschließlich über den Supabase-Auth-Client übertragen und nicht in Zeitwerk-Daten oder lokalem App-Speicher abgelegt.

E-Mail-Links und Passwort-Wiederherstellung bleiben als Alternative verfügbar. Ein 60-Sekunden-Schutz verhindert doppelte Anfragen und bleibt beim Neuladen erhalten. Das echte Versandlimit des Anbieters wird dadurch nicht angehoben. Bei erreichtem Limit ein bereits angemeldetes Gerät zum Festlegen des Passworts nutzen; wenn keine Anmeldung mehr besteht, muss der Versand wieder verfügbar sein oder ein eigener SMTP-Dienst separat eingerichtet werden. Die Abmeldung anderer Sitzungen wird bei bereits ausgegebenen Zugriffstokens verzögert wirksam.

`tests/account.cjs` prüft Passwort-Anmeldung trotz E-Mail-Sperre, Fehlerübersetzung, Versandpause, Passwortvalidierung und -änderung, fehlende Passwortablage, Wiederherstellungsereignis und Abmeldung anderer Sitzungen mit einem isolierten Auth-Testtransport. Es werden weder echte Passwörter gesetzt noch Test-E-Mails versendet.

## Siri und CarPlay

Unter Konto & Sync → Siri & CarPlay lässt sich ein persönlicher Kurzbefehl-Schlüssel erstellen. Damit startet und stoppt ein iOS-Kurzbefehl die gemeinsame Stempeluhr per Siri, auch im Auto über CarPlay, ohne die App zu öffnen. Projekt und Arbeitsort werden wie beim normalen Ausstempeln danach in der App ergänzt. Eine eigene CarPlay-App ist nicht nötig. Einrichtung der Datenbankfunktionen: [backend/SETUP.md](backend/SETUP.md#siri-und-carplay-stempeluhr-per-kurzbefehl).
