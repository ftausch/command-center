'use client';
// React Error Boundary — catches any uncaught render error in the app tree
// (e.g. Supabase 503 returning null where an array is expected) and shows a
// friendly recovery UI instead of the generic Next.js crash page.

import { Component } from 'react';

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message ?? 'Unbekannter Fehler',
    };
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary] caught:', error?.message, info?.componentStack?.slice(0, 300));
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#fcf8fa', padding: '40px 24px',
      }}>
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1b1b1d', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            Verbindungsproblem
          </h1>
          <p style={{ fontSize: 14.5, color: '#45464d', lineHeight: 1.6, margin: '0 0 24px' }}>
            Command Center konnte keine Verbindung zum Server aufbauen. Das passiert manchmal bei kurzen Ausfällen.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#131b2e', color: '#fff', border: 'none',
                padding: '11px 22px', borderRadius: 8, fontSize: 14,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              Neu laden
            </button>
            <button
              onClick={() => this.setState({ hasError: false, message: null })}
              style={{
                background: 'transparent', color: '#45464d',
                border: '1px solid #e4e2e4',
                padding: '11px 22px', borderRadius: 8, fontSize: 14,
                fontWeight: 500, cursor: 'pointer',
              }}
            >
              Nochmal versuchen
            </button>
          </div>
          <details style={{ marginTop: 20, textAlign: 'left' }}>
            <summary style={{ fontSize: 12, color: '#76777d', cursor: 'pointer' }}>Details anzeigen</summary>
            <pre style={{ fontSize: 11, color: '#76777d', marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#f0edef', padding: '10px', borderRadius: 6 }}>
              {this.state.message}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
