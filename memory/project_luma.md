---
name: luma-integration-pending
description: Luma (lu.ma) API integration planned for Command Center — API key to be added tomorrow
metadata:
  type: project
---

Luma Integration steht aus — API Key wird morgen eingetragen.

**Geplanter Scope (alle 4 Features bestätigt):**
1. Luma-Link speichern → `eventMeta.lumaUrl` + "Auf Luma öffnen" Button im Event Detail
2. Event importieren → Luma URL eingeben im NewEventModal → Titel/Datum/Location per API vorausfüllen
3. RSVP-Zähler → `getLumaEventStats()` Server Action → Anmeldezahl in Event Hub + Event Detail
4. Gästeliste sync → "Von Luma importieren" Button im Gäste-Tab → confirmed guests in `event_attendees`

**Setup-Schritte morgen:**
1. Luma → Settings → API → "Create API Key" → kopieren
2. Vercel → command-center → Settings → Environment Variables → `LUMA_API_KEY` eintragen (Production)
3. Redeploy triggern
4. Dann bauen: `lib/integrations/luma.ts` + NewEventModal + EventOps AttendeeList + ProjectDetail

**Luma API Basis-URL:** `https://api.lu.ma/public/v1/`
**Auth:** `x-luma-api-key: <KEY>` Header

**Relevante Endpoints:**
- `GET /event/get?api_id=<id>` — Event-Details (Titel, Datum, Location, Cover)
- `GET /event/get-guests?event_api_id=<id>` — Gästeliste (name, email, approval_status)
- Luma Event URL Format: `lu.ma/EVENT-SLUG` → API ID aus URL extrahieren

**Why:** Luma ist das Event-Anmelde-Tool von Unicorn Bakery. Schließt den Kreis zwischen Anmeldung (Luma) und Produktion (Command Center).
