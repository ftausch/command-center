---
name: luma-integration-live
description: Luma (lu.ma) API integration fully built and live in Command Center — LUMA_API_KEY set in Vercel Production
metadata:
  type: project
---

Luma Integration ist vollständig gebaut und live. `LUMA_API_KEY` ist in Vercel Production eingetragen.

**Gebaute Features (alle live):**

1. **API Client — `lib/integrations/luma.ts`**
   - `getLumaEvent(slug)` — ruft Event-Details (Titel, Datum, Location, Cover) ab
   - `getLumaGuests(slug)` — ruft Gästeliste ab (name, email, approval_status)
   - `extractLumaSlug(input)` — parst sowohl `evt-xxx` IDs als auch `luma.com/event/manage/...` URLs

2. **Server Actions — `lib/actions/luma.ts`**
   - `fetchLumaEventPreview(url)` — gibt Titel/Datum/Location für Auto-Fill zurück
   - `getLumaRsvpCount(slug)` — gibt Anmeldezahl zurück
   - `syncLumaGuests(eventId, slug)` — schreibt confirmed guests in `event_attendees`

3. **NewEventModal — Luma Import Box**
   - Luma-URL eingeben → Titel, Location, Datum werden automatisch ausgefüllt

4. **EventOps AttendeeList — "Von Luma importieren" Button**
   - Sync-Button im Gäste-Tab lädt confirmed Luma-Gäste in die Datenbank

5. **LumaRsvpBadge Component**
   - Zeigt Live-RSVP-Zahl aus Luma
   - Sichtbar im EventDetail Sidebar und auf EventHub Cards

**Luma API Basis-URL:** `https://api.lu.ma/public/v1/`
**Auth:** `x-luma-api-key: <KEY>` Header

**Relevante Endpoints:**
- `GET /event/get?api_id=<id>` — Event-Details (Titel, Datum, Location, Cover)
- `GET /event/get-guests?event_api_id=<id>` — Gästeliste (name, email, approval_status)
- Luma Event URL Format: `lu.ma/EVENT-SLUG` → API ID via `extractLumaSlug()` extrahiert

**Why:** Luma ist das Event-Anmelde-Tool von Unicorn Bakery. Schließt den Kreis zwischen Anmeldung (Luma) und Produktion (Command Center).
