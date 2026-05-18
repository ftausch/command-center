---
name: luma-integration-pending
description: Luma (lu.ma) API integration planned for Command Center — waiting for API key
metadata:
  type: project
---

Luma Integration steht aus — API Key fehlt noch.

**Geplanter Scope (alle 4 Features bestätigt):**
1. Luma-Link speichern → `eventMeta.lumaUrl` + "Auf Luma öffnen" Button im Event Detail
2. Event importieren → Luma URL eingeben im NewEventModal → Titel/Datum/Location per API vorausfüllen
3. RSVP-Zähler → `getLumaEventStats()` Server Action → Anmeldezahl in Event Hub + Event Detail
4. Gästeliste sync → "Von Luma importieren" Button im Gäste-Tab → confirmed guests in `event_attendees`

**Was gebraucht wird:**
- `LUMA_API_KEY` in Vercel eintragen (Luma → Settings → API → "Create API Key")
- Kein neues SQL nötig

**Why:** Luma ist das Event-Anmelde-Tool von Unicorn Bakery. Integration schließt den Kreis zwischen Anmeldung (Luma) und Produktion (Command Center).

**How to apply:** Sobald API Key vorhanden: lib/integrations/luma.ts erstellen, NewEventModal + EventOps.jsx (AttendeeList) + ProjectDetail erweitern.
