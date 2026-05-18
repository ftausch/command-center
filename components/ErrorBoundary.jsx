'use client';
// React Error Boundary — catches render crashes and shows a friendly fallback.

import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const msg = this.state.error?.message ?? 'Unbekannter Fehler';
    const isNetwork = msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network');

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', padding: 40, textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>{isNetwork ? '🌐' : '⚠️'}</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text-1)' }}>
          {isNetwork ? 'Verbindungsproblem' : 'Etwas ist schiefgelaufen'}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-3)', maxWidth: 400, lineHeight: 1.6, marginBottom: 24 }}>
          {isNetwork
            ? 'Bitte überprüfe deine Internetverbindung und lade die Seite neu.'
            : 'Ein unerwarteter Fehler ist aufgetreten. Bitte lade die Seite neu.'}
        </p>
        <div style={{ fontSize: 12, color: 'var(--text-4)', background: 'var(--bg-sunk)', padding: '6px 12px', borderRadius: 6, marginBottom: 20, maxWidth: 400, wordBreak: 'break-all' }}>
          {msg}
        </div>
        <button
          onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
          style={{
            background: 'var(--brand)', color: 'white', border: 'none',
            borderRadius: 8, padding: '10px 24px', cursor: 'pointer',
            fontSize: 14, fontWeight: 600,
          }}
        >
          Seite neu laden
        </button>
      </div>
    );
  }
}
