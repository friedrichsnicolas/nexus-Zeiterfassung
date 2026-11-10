# Zeitwerk – persönliche Projekt- und Arbeitszeiterfassung

Responsive Web-App ohne Build-Schritt und ohne Server. Unterstützt Desktop, iPhone und iPad im Browser.

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
Die Zeitdaten liegen ausschließlich im localStorage dieses Browsers, pro Domain und Browserprofil. Regelmäßig JSON-Backups erstellen. Browserdaten löschen, privater Modus und Gerätewechsel können die Daten entfernen. Es gibt keine automatische Synchronisierung und keine Anmeldung. GitHub Pages veröffentlicht den App-Code; persönliche Einträge werden nicht ins Repository geschrieben.

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

Die Urlaubsseite zeigt eine Monatsansicht: Urlaub grün, NRW-Feiertage gelb und Projekt-/Ortsangaben blau. Ein Klick auf ein Datum öffnet alle Details und die Bearbeitung vorhandener Zeiteinträge. Wochenend- und Feiertage innerhalb eines Urlaubszeitraums sind als ohne Abzug gekennzeichnet. Über Mitternacht laufende Projekte erscheinen an den betroffenen Tagen, ein Ende genau um 00:00 nicht zusätzlich am Folgetag. Alle Einstellungen sind Teil der JSON-Sicherung.



## Geräteübergreifende Synchronisierung (vorbereitet)
Die Seite Konto & Sync enthält Anmeldung per E-Mail-Link, Datenübernahme und Konfliktauswahl. Die Cloud ist erst aktiv, wenn das persönliche Supabase-Projekt tatsächlich eingerichtet und in `sync-config.js` konfiguriert wurde. Ohne Konfiguration arbeitet die App ausschließlich lokal weiter.

Siehe [backend/SETUP.md](backend/SETUP.md) und [backend/setup.sql](backend/setup.sql) für die konkrete Einrichtung und die erforderlichen Live-Prüfungen. Daten, Stempelstatus und Urlaubs-/Projekteinstellungen werden als private, versionsgeprüfte Dokumente je Benutzer gespeichert. Gleichzeitige Änderungen erfordern eine bewusste Auswahl; sie werden nicht automatisch zusammengeführt. Offline-Änderungen bleiben lokal vorgemerkt.

Das Browser-SDK wird lokal ausgeliefert (Version 2.119.0, MIT, `SUPABASE-LICENSE`). `node tests/sync.cjs` prüft den clientseitigen Konflikt-/Wiederholungsablauf mit simuliertem Backend; dies ersetzt keinen Live-Test der Datenbank, RLS-Regeln und E-Mail-Anmeldung.
