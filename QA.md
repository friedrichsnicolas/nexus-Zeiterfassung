# Funktionsprüfung · 10. November 2026

## Behobene Ursachen

- Ein bereits ausgestempelter Vorgang wartet auf Randdaten. Die Maske wird nun beim Laden und nach Cloud-Übernahme automatisch vorbelegt, und der Abschluss ist als primäre Aktion hervorgehoben.
- Ein laufender Cloud-Abgleich oder eine Konfliktauswahl sperrt keine lokalen Zeitbuchungen mehr. Ein Versionsvergleich verhindert weiterhin stilles Überschreiben der Cloud.
- Lokale Änderungen während eines Downloads verhindern dessen Übernahme; während eines Uploads bleiben neue Änderungen für den nächsten Abgleich vorgemerkt.
- Zeiteintrag und Stempelstatus werden gemeinsam gespeichert; Fehler führen zum vorherigen lokalen Stand zurück.
- Veraltete Tabs zeigen eine Aktualisierungsaktion. Der Kontostatus ist auf allen Seiten erreichbar.
- Ein leerer Cloud-Stand übernimmt die bestehenden lokalen Daten beim ersten Login ohne unnötige Konfliktauswahl.

## Automatisierte Prüfungen

`npm ci --ignore-scripts` und `npm test` führen bei jedem Deployment dieselben Prüfungen aus.

| Bereich | Geprüft |
| --- | --- |
| Stempeluhr | Start, Doppelklick, Ende, Vorbelegung nach Neuladen, Abschluss, erneuter Start, Speicherfehler |
| Erfassung | Arbeits-/Reisezeit, Pause, optionaler Ort, Überschneidung, Bearbeiten, Löschen |
| Ansichten | Navigation aller sieben Seiten, Dashboard-Filter, Tages-/Wochen-/Jahresansicht, Summen |
| Urlaub | Anspruch, Übertrag, Verfall, halbe Tage, Überschneidung, Jahreswechsel, NRW-Feiertage |
| Kalender | Urlaub, Projekte und Orte, Monatswechsel, Tagesgrenzen |
| Export & Sicherung | Excel-XML/CSV-Inhalt, Druckaktion, vollständige JSON-Sicherung und Wiederherstellung, ungültiger Import |
| Cloud | Initialisierung, Kontowechsel, Konflikt, Offline-Wiederholung, identische Operations-ID, veralteter Tab, Änderungen während Upload/Download |

Alle 22 vollständigen Anwendungsabläufe, 21 Berechnungsfälle und die Sync-Regressionstests bestanden. Tests verwenden isolierte Beispieldaten.

## Browserprüfung

Einstempeln, Erhalt beim Neuladen, Ausstempeln, automatische Vorbelegung eines offenen Abschlusses und Speichern mit anschließend wieder freiem Start wurden im Browser geprüft. Desktop- und 390-Pixel-Layout sowie die mobile Navigation und Urlaubsansicht wurden visuell geprüft.

## Grenzen der Prüfung

Der tatsächliche Abgleich zweier unabhängiger Geräte mit derselben angemeldeten Person wurde in dieser Sitzung nicht vollständig durchgespielt. Das persönliche Cloud-Dokument wurde nur diagnostisch gelesen. Die Druckaktion wird automatisiert geprüft; das konkrete PDF-Ergebnis hängt vom lokalen Browser-Druckdialog ab. Der Export für Excel bleibt SpreadsheetML-XML, kein natives XLSX.

## Ergänzung: gemeinsamer Timer

Fünf zusätzliche geräteübergreifende Integrationsfälle bestanden: Start am Computer erscheint auf dem Handy trotz Eingabeentwurf; Ausstempeln am Handy erreicht den Computer über den Polling-Rückfall; Abschluss erzeugt genau einen Eintrag auf beiden Instanzen; gleichzeitige Projektänderung und Stopp bleiben beide erhalten; Abmeldung zeigt ausdrücklich lokale Erfassung an. Der Testtransport sortiert JSON-Objektschlüssel wie ein JSONB-Roundtrip. Die tatsächlich aktivierte Realtime-Publikation, weiterhin aktive RLS und fehlende anonyme Leseberechtigung wurden im Projekt geprüft. Die Tests verwenden getrennte App-Laufzeiten und einen Testtransport, keine persönlichen Login-Sitzungen.

## Ergänzung: Kontoverwaltung

Neun isolierte Auth-Prüfungen bestanden: ungültiges Passwort, E-Mail-Versandlimit mit Doppelklickschutz, Versandpause nach Neuladen, Passwort-Anmeldung trotz Versandpause, kurze/abweichende Passwortwiederholungen, Passwortänderung ohne Speicherung in App-Daten, Abmeldung anderer Sitzungen, Wiederherstellungsereignis und Wiederherstellungslink-Anfrage. Reale persönliche Passwörter wurden nicht durch die Automatisierung gesetzt oder ausgelesen. Der echte Versand wird bei erreichtem Anbieterlimit nicht getestet oder wiederholt angefragt.
