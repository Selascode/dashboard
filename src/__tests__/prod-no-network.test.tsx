import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { resetMemoryFallbackStore, seedDemoData } from '../lib/db';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

describe('Vie privée & Zéro appel réseau sur le build de production (PRV-1, PRV-2)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    resetMemoryFallbackStore();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("n'effectue aucun appel réseau (fetch / XMLHttpRequest) au démarrage ni lors de la navigation Dashboard -> Tâches (PRV-1)", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.reject(new Error('Appel réseau interdit par PRV-1')),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const xhrOpenSpy = vi.spyOn(XMLHttpRequest.prototype, 'open');

    seedDemoData();
    render(<App />);

    expect(await screen.findByTestId('page-dashboard')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('nav-tasks'));
    expect(await screen.findByTestId('page-tasks')).toBeInTheDocument();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrOpenSpy).not.toHaveBeenCalled();
  });

  it('ne référence aucun CDN externe ni police distante dans index.html ni dans le build de production dist/ (PRV-2)', () => {
    const rootDir = path.resolve(__dirname, '../..');
    const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');

    const forbiddenPatterns = [
      /https?:\/\/fonts\.googleapis\.com/i,
      /https?:\/\/fonts\.gstatic\.com/i,
      /https?:\/\/cdn\./i,
      /https?:\/\/unpkg\.com/i,
      /https?:\/\/cdn\.jsdelivr\.net/i,
    ];

    for (const pattern of forbiddenPatterns) {
      expect(indexHtml).not.toMatch(pattern);
    }

    const distDir = path.join(rootDir, 'dist');
    if (fs.existsSync(distDir)) {
      const distIndex = path.join(distDir, 'index.html');
      if (fs.existsSync(distIndex)) {
        const distHtmlContent = fs.readFileSync(distIndex, 'utf-8');
        for (const pattern of forbiddenPatterns) {
          expect(distHtmlContent).not.toMatch(pattern);
        }
        // Toutes les ressources JS/CSS du build de production sont locales
        const externalScriptOrStylesheet =
          /<(script|link)\b[^>]*(src|href)=["']https?:\/\//i;
        expect(distHtmlContent).not.toMatch(externalScriptOrStylesheet);
      }

      const assetsDir = path.join(distDir, 'assets');
      if (fs.existsSync(assetsDir)) {
        const assetFiles = fs.readdirSync(assetsDir);
        const woffFiles = assetFiles.filter((f) => f.endsWith('.woff2') || f.endsWith('.woff'));
        expect(woffFiles.length).toBeGreaterThan(0);

        for (const file of assetFiles) {
          if (file.endsWith('.css') || file.endsWith('.js')) {
            const content = fs.readFileSync(path.join(assetsDir, file), 'utf-8');
            for (const pattern of forbiddenPatterns) {
              expect(content).not.toMatch(pattern);
            }
          }
        }
      }
    }
  });
});
