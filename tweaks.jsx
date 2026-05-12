// Tweaks — three expressive controls that reshape the feel
// 1. Density   — Compact / Default / Spacious   (rhythm + sidebar width)
// 2. Surface   — Paper / Studio / Carbon         (background tone + dark mode)
// 3. Brand     — Subtle / Confident / Bold       (how loud the brand accent reads)

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "default",
  "surface": "paper",
  "brand": "subtle"
}/*EDITMODE-END*/;

// Inject the variant CSS once
(function injectTweakStyles() {
  if (document.getElementById('__cc_tweak_styles')) return;
  const css = `
    /* ── DENSITY ────────────────────────────────────────── */
    body[data-cc-density="compact"]  { --sidebar-w: 220px; --topbar-h: 48px; }
    body[data-cc-density="compact"]  .card-pad     { padding: 14px 16px; }
    body[data-cc-density="compact"]  .page         { padding: 18px 22px; }
    body[data-cc-density="compact"]  .nav-item     { padding: 5px 10px; min-height: 28px; }
    body[data-cc-density="compact"]  .table td,
    body[data-cc-density="compact"]  .table th     { padding: 9px 12px; }
    body[data-cc-density="compact"]  .h1           { font-size: 22px; }
    body[data-cc-density="compact"]  .h2           { font-size: 16px; }
    body[data-cc-density="compact"]  { font-size: 13px; }

    body[data-cc-density="spacious"] { --sidebar-w: 272px; --topbar-h: 64px; }
    body[data-cc-density="spacious"] .card-pad     { padding: 28px 30px; }
    body[data-cc-density="spacious"] .page         { padding: 40px 44px; }
    body[data-cc-density="spacious"] .nav-item     { padding: 10px 14px; min-height: 38px; }
    body[data-cc-density="spacious"] .table td,
    body[data-cc-density="spacious"] .table th     { padding: 16px 18px; }
    body[data-cc-density="spacious"] .h1           { font-size: 30px; letter-spacing: -0.025em; }
    body[data-cc-density="spacious"] .h2           { font-size: 20px; }
    body[data-cc-density="spacious"] .page-head    { padding-bottom: 28px; margin-bottom: 28px; }

    /* ── SURFACE: STUDIO (cool neutral) ─────────────────── */
    body[data-cc-surface="studio"] {
      --bg: #f3f5f7;
      --bg-elev: #ffffff;
      --bg-sunk: #e9ecf0;
      --bg-hover: #e4e8ed;
      --bg-active: #dde1e7;
      --border: #dee2e8;
      --border-strong: #c8ced6;
      --border-soft: #e8ebef;
      --text-1: #0e131c;
      --text-2: #4b5363;
      --text-3: #7c8493;
      --text-4: #aab1bd;
    }

    /* ── SURFACE: CARBON (dark) ─────────────────────────── */
    body[data-cc-surface="carbon"] {
      --bg: #0e1014;
      --bg-elev: #16191f;
      --bg-sunk: #0a0c10;
      --bg-hover: #1c2028;
      --bg-active: #232832;
      --border: #232730;
      --border-strong: #313644;
      --border-soft: #1b1e25;
      --text-1: #ebecef;
      --text-2: #a6abb6;
      --text-3: #71768a;
      --text-4: #4a4e5b;
      --text-inv: #0e1014;
      --shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
      --shadow-md: 0 2px 6px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.5);
      --shadow-lg: 0 12px 32px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.4);
      --shadow-pop: 0 24px 60px rgba(0,0,0,0.7), 0 4px 12px rgba(0,0,0,0.4);
      --success: oklch(0.72 0.13 145);
      --success-bg: oklch(0.28 0.05 145);
      --success-border: oklch(0.36 0.07 145);
      --warning: oklch(0.78 0.13 70);
      --warning-bg: oklch(0.30 0.06 70);
      --warning-border: oklch(0.38 0.09 70);
      --danger: oklch(0.70 0.16 25);
      --danger-bg: oklch(0.28 0.07 25);
      --danger-border: oklch(0.38 0.10 25);
      --info: oklch(0.72 0.12 240);
      --info-bg: oklch(0.28 0.05 240);
      --info-border: oklch(0.36 0.07 240);
      --neutral: #a6abb6;
      --neutral-bg: #1c2028;
      --neutral-border: #313644;
    }
    body[data-cc-surface="carbon"][data-brand="unicornbakery"] {
      --brand: #6ba7d8; --brand-soft: rgba(107,167,216,0.12); --brand-strong: #97c1e2;
    }
    body[data-cc-surface="carbon"][data-brand="selbstfrei"] {
      --brand: #c39af0; --brand-soft: rgba(195,154,240,0.12); --brand-strong: #d6b6f5;
    }
    body[data-cc-surface="carbon"] .btn-primary { background: #ebecef; color: #0e1014; }
    body[data-cc-surface="carbon"] .btn-primary:hover { background: #fff; }

    /* ── BRAND INTENSITY ──────────────────────────────────── */
    /* Subtle = current default. No-op. */

    /* Confident: brand color drives active rails, hover edges, and sidebar pill. */
    body[data-cc-brand-intensity="confident"] .nav-item.active {
      background: var(--brand-soft);
      color: var(--brand);
      box-shadow: inset 2px 0 0 var(--brand);
    }
    body[data-cc-brand-intensity="confident"] .nav-item.active svg { color: var(--brand); }
    body[data-cc-brand-intensity="confident"] .brand-pill {
      background: var(--brand-soft);
      border-color: color-mix(in oklch, var(--brand) 28%, var(--border));
    }
    body[data-cc-brand-intensity="confident"] .btn-brand {
      background: var(--brand); color: #fff; border-color: var(--brand);
    }
    body[data-cc-brand-intensity="confident"] .btn-brand:hover { background: var(--brand-strong); }
    body[data-cc-brand-intensity="confident"] .page-head .h1,
    body[data-cc-brand-intensity="confident"] .label {
      /* keep typography neutral */
    }

    /* Bold: sidebar gets a soft brand wash; topbar inherits a tinted bottom rule; pinned rails grow. */
    body[data-cc-brand-intensity="bold"] .nav-item.active {
      background: var(--brand);
      color: #fff;
      box-shadow: none;
    }
    body[data-cc-brand-intensity="bold"] .nav-item.active svg,
    body[data-cc-brand-intensity="bold"] .nav-item.active .nav-count { color: #fff; }
    body[data-cc-brand-intensity="bold"] .nav-item.active .nav-count { background: rgba(255,255,255,0.18); }
    body[data-cc-brand-intensity="bold"] .sidebar {
      background: linear-gradient(180deg, var(--brand-soft) 0%, var(--bg) 280px);
      border-right-color: color-mix(in oklch, var(--brand) 18%, var(--border));
    }
    body[data-cc-brand-intensity="bold"] .brand-pill {
      background: var(--brand); color: #fff; border-color: var(--brand);
    }
    body[data-cc-brand-intensity="bold"] .brand-pill .brand-mark {
      background: rgba(255,255,255,0.18); color: #fff;
    }
    body[data-cc-brand-intensity="bold"] .brand-pill .brand-name { color: #fff; }
    body[data-cc-brand-intensity="bold"] .brand-pill .brand-sub  { color: rgba(255,255,255,0.7); }
    body[data-cc-brand-intensity="bold"] .brand-pill .caret      { color: rgba(255,255,255,0.6); }
    body[data-cc-brand-intensity="bold"] .topbar {
      border-bottom-color: color-mix(in oklch, var(--brand) 22%, var(--border));
    }
    body[data-cc-brand-intensity="bold"] .btn-brand {
      background: var(--brand); color: #fff; border-color: var(--brand);
    }
    body[data-cc-brand-intensity="bold"] .btn-brand:hover { background: var(--brand-strong); }

    /* Smooth all transitions when toggling */
    body { transition: background-color .25s ease, color .25s ease; }
    .card, .sidebar, .topbar, .nav-item, .btn, .brand-pill {
      transition: background-color .2s ease, color .2s ease, border-color .2s ease, box-shadow .2s ease;
    }
  `;
  const s = document.createElement('style');
  s.id = '__cc_tweak_styles';
  s.textContent = css;
  document.head.appendChild(s);
})();

function CommandCenterTweaks() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => {
    document.body.dataset.ccDensity = t.density;
    document.body.dataset.ccSurface = t.surface;
    document.body.dataset.ccBrandIntensity = t.brand;
  }, [t.density, t.surface, t.brand]);

  return (
    <TweaksPanel>
      <TweakSection label="Density" />
      <TweakRadio
        label="Rhythm"
        value={t.density}
        options={['compact', 'default', 'spacious']}
        onChange={(v) => setTweak('density', v)}
      />

      <TweakSection label="Surface" />
      <TweakRadio
        label="Mood"
        value={t.surface}
        options={['paper', 'studio', 'carbon']}
        onChange={(v) => setTweak('surface', v)}
      />

      <TweakSection label="Brand presence" />
      <TweakRadio
        label="Loudness"
        value={t.brand}
        options={['subtle', 'confident', 'bold']}
        onChange={(v) => setTweak('brand', v)}
      />

      <div style={{
        marginTop: 4, padding: '10px 12px',
        background: 'rgba(0,0,0,0.04)', borderRadius: 8,
        fontSize: 11, lineHeight: 1.5, color: 'rgba(41,38,27,0.7)',
      }}>
        Three knobs that change the <i>feel</i> — not single properties. Try{' '}
        <b>Carbon&nbsp;+&nbsp;Bold</b> for a control-room vibe, or{' '}
        <b>Paper&nbsp;+&nbsp;Spacious&nbsp;+&nbsp;Subtle</b> for editorial calm.
      </div>
    </TweaksPanel>
  );
}

// Mount the panel alongside the existing app root
(function mountTweaks() {
  const host = document.createElement('div');
  host.id = '__cc_tweaks_root';
  document.body.appendChild(host);
  ReactDOM.createRoot(host).render(<CommandCenterTweaks />);
})();
