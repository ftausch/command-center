'use server';
// Podcast Hub server actions.
//
// generateMarketingPackage — calls Claude Haiku to turn an episode
// transcript into a newsletter draft, 3 LinkedIn posts, and show notes.
// Falls back to a structured mock when ANTHROPIC_API_KEY is absent.

import type { ActionResult } from '@/lib/types';

export interface MarketingPackage {
  newsletter: string;
  linkedin: [string, string, string];
  shownotes: string;
}

const MOCK_PACKAGE: MarketingPackage = {
  newsletter: `**Betreff:** Diese Woche im UnicornBakery Podcast 🎙️

Hallo {{first_name}},

in der neuesten Folge tauche ich tief ein in die Strategien, die Top-Gründer nutzen, um in einem schwierigen Marktumfeld zu wachsen.

**Was du lernst:**
• Wie du mit begrenzten Ressourcen maximale Wirkung erzielst
• Warum der richtige Zeitpunkt für Fundraising entscheidend ist
• Die 3 häufigsten Fehler bei der Skalierung – und wie du sie vermeidest

👉 **[Episode jetzt hören →](https://unicornbakery.de/podcast)**

Bis nächste Woche,
Fabian

---
*Du erhältst diesen Newsletter, weil du dich auf unicornbakery.de angemeldet hast.*`,

  linkedin: [
    `🎙️ Neue Podcast-Folge: Heute teile ich das Gespräch, das mein Verständnis von Product-Market-Fit komplett verändert hat.

Die wichtigste Erkenntnis aus 2 Stunden Interview? PMF ist kein Zustand – es ist ein kontinuierlicher Prozess.

→ Link in den Kommentaren

#Podcast #Startup #Gründer #UnicornBakery`,

    `3 Dinge, die ich von den erfolgreichsten Gründern im DACH-Raum gelernt habe:

1️⃣ Sie pitchen nicht – sie erzählen Geschichten
2️⃣ Sie skalieren erst, wenn Unit Economics stimmen
3️⃣ Sie bauen Teams für den nächsten Schritt, nicht für heute

Alle Details in der neuen Episode. 🔗 Kommentare 👇

#Unternehmertum #Leadership #Wachstum`,

    `Was trennt ein 1M ARR Startup von einem 10M ARR Startup?

Laut meinem heutigen Gast: Fast nichts Technisches.

Es ist die Fähigkeit, "Nein" zu sagen – zu Features, zu Kunden, zu Wachstum, das nicht zum richtigen Zeitpunkt kommt.

Hör rein: #UnicornBakery Podcast, neue Folge live 🎧

#SaaS #B2B #Founder`,
  ],

  shownotes: `## Show Notes

**Gast:** [Name aus Transkript]
**Episode:** UnicornBakery Podcast

### Kernthemen dieser Folge
- Aufbau von skalierbaren Go-to-Market-Strategien im B2B-Bereich
- Fundraising-Timing und Investor-Kommunikation
- Team-Aufbau in der Frühphase

### Erwähnte Ressourcen
- [Buch/Tool 1]
- [Framework]
- [Weitere Links]

### Zeitstempel
- **00:00** – Intro
- **05:30** – Gründungsgeschichte
- **18:45** – Der entscheidende Pivot
- **34:20** – Skalierung und Team
- **51:00** – Learnings & Ausblick

### Über den Gast
[Biografie aus Transkript extrahiert]

### Folge UnicornBakery
🌐 [unicornbakery.de](https://unicornbakery.de)
📧 Newsletter | 🐦 Twitter | 💼 LinkedIn`,
};

export async function generateMarketingPackage(input: {
  episodeTitle: string;
  transcript: string;
  guest?: string;
}): Promise<ActionResult<MarketingPackage>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // No key → return mock with episode title injected
    return {
      ok: true,
      data: {
        ...MOCK_PACKAGE,
        shownotes: MOCK_PACKAGE.shownotes.replace('[Name aus Transkript]', input.guest ?? 'Gast'),
      },
    };
  }

  try {
    // Dynamic import so the module only loads server-side
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });

    const prompt = `Du bist ein erfahrener Podcast-Marketing-Manager für den UnicornBakery Podcast von Fabian Tausch.

Erstelle basierend auf diesem Episodentitel und Transkript-Auszug ein komplettes Marketing-Paket auf Deutsch.

Episode: "${input.episodeTitle}"
Gast: ${input.guest ?? 'Unbekannt'}

Transkript-Auszug:
${input.transcript.slice(0, 3000)}

Erstelle GENAU dieses JSON-Format (kein Markdown drumherum):
{
  "newsletter": "Vollständiger Newsletter-Text (mit Betreffzeile, Intro, Kernpunkte, CTA)",
  "linkedin": [
    "Erster LinkedIn-Post (Hook + Story + CTA + Hashtags)",
    "Zweiter LinkedIn-Post (anderer Angle, Listicle-Format)",
    "Dritter LinkedIn-Post (Frage oder kontroverses Statement + CTA)"
  ],
  "shownotes": "Vollständige Show Notes mit Zeitstempeln, Ressourcen, Gäste-Bio"
}`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');

    const raw = content.text.trim();
    const jsonStr = raw.startsWith('{') ? raw : raw.slice(raw.indexOf('{'));
    const pkg = JSON.parse(jsonStr) as MarketingPackage;

    return { ok: true, data: pkg };
  } catch (e: any) {
    console.error('[podcast] generateMarketingPackage failed', e?.message);
    return { ok: false, error: `KI-Generierung fehlgeschlagen: ${e?.message ?? 'Unbekannter Fehler'}` };
  }
}
