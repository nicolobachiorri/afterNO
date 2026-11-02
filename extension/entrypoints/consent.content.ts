// Content script: runs inside every page (and its frames) to notice the user's
// choice in the cookie banner. It sends the background only the choice itself,
// never the page content.
//
// A content script lives in an "isolated world": it shares the page's DOM, but not
// its JavaScript variables, so it cannot call the page's window.__tcfapi directly.
// The TCF standard also defines a message protocol (postMessage), meant for code in
// other frames: we use that, so no code of ours runs inside the page itself.
import { browser } from 'wxt/browser';
import {
  choiceFromTcf, classifyControl, classifyLabel, inConsentContext, MAX_LABEL,
  type ChoiceMessage, type ChoiceRecord, type TcData,
} from '@/lib/choice';

function send(record: Omit<ChoiceRecord, 'site'>): void {
  const msg: ChoiceMessage = { type: 'choice', record };
  // Fire and forget: no answer is needed, and failures (extension reloading) are harmless.
  browser.runtime.sendMessage(msg).catch(() => {});
}

// The choice is also kept for a moment in the page's own session storage (see the
// click handler), under this key, so that it survives a reload made by the banner.
// Removed as soon as it has been sent again; ignored when older than two minutes.
const PENDING_KEY = '__cookie_summary_choice';
const PENDING_MAX_AGE_MS = 120_000;

function resendPending(): void {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return;
    sessionStorage.removeItem(PENDING_KEY);
    const record = JSON.parse(raw) as Omit<ChoiceRecord, 'site'>;
    if (typeof record.at === 'number' && Date.now() - record.at < PENDING_MAX_AGE_MS) send(record);
  } catch { /* storage blocked or malformed: nothing to resend */ }
}

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  allFrames: true, // many banners live in an iframe served by the consent platform
  main(ctx) {
    resendPending();

    // ---------------------------------------------------------------- 1. TCF
    // Only the top frame asks: the consent platform answers for the whole page.
    if (window === window.top) {
      const callId = `cookie-summary-${Math.random().toString(36).slice(2)}`;
      let answered = false;

      ctx.addEventListener(window, 'message', (event: MessageEvent) => {
        let data: unknown = event.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch { return; } // some platforms send JSON text
        }
        const ret = (data as { __tcfapiReturn?: { callId?: string; returnValue?: TcData; success?: boolean } })
          ?.__tcfapiReturn;
        if (!ret || ret.callId !== callId || !ret.success || !ret.returnValue) return;
        answered = true;
        // The site is filled in by the background, so pass an empty one here.
        const record = choiceFromTcf(ret.returnValue, '', Date.now());
        if (record) {
          const { site: _site, ...rest } = record;
          send(rest);
        }
      });

      // 'addEventListener' makes the platform answer now and again at every change
      // (stored choice loaded, banner shown, user clicked). The platform may load
      // after us, so we ask a few times until it answers.
      const ask = () => {
        if (answered) return;
        window.postMessage({ __tcfapiCall: { command: 'addEventListener', version: 2, callId } }, '*');
      };
      for (const delay of [0, 1000, 3000, 6000, 10000]) ctx.setTimeout(ask, delay);
    }

    // ---------------------------------------------------------------- 2. Clicks
    // Capture phase: we see the click even if the banner stops it from bubbling.
    ctx.addEventListener(document, 'click', (event: Event) => {
      // composedPath()[0] is the element really clicked, also inside a shadow DOM;
      // event.target would only be the outer host element.
      const first = event.composedPath()[0];
      const target = first instanceof Element ? first : null;
      // A real control, or else a short text that reads as a choice: some banners use a
      // clickable <span> or <div> (agriturismo.it). Up to three levels above the click.
      let control = target?.closest('button, a, [role="button"], input[type="button"], input[type="submit"]') ?? null;
      for (let el: Element | null = target, i = 0; !control && el && i < 3; el = el.parentElement, i++) {
        const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (text && text.length <= MAX_LABEL && classifyLabel(text)) control = el;
      }
      if (!control) return;
      // Visible text first; for icon-only buttons, the accessibility descriptions.
      const visible = (control instanceof HTMLInputElement ? control.value : control.textContent) ?? '';
      const label = visible.trim() || control.getAttribute('aria-label') || control.getAttribute('title') || '';
      // Internal names given by the consent platform: id, classes, data-* values.
      const attrs = [control.id, control.getAttribute('class') ?? '',
        ...[...control.attributes].filter((a) => a.name.startsWith('data-')).map((a) => a.value)].join(' ');
      const kind = classifyControl(label, attrs);
      if (!kind) return;
      // Texts of the containers around the button, from the closest outwards.
      const texts: string[] = [];
      const names: string[] = [];
      // At a shadow DOM boundary parentElement is null: continue from the host element.
      const up = (el: Element): Element | null => {
        if (el.parentElement) return el.parentElement;
        const root = el.getRootNode();
        return root instanceof ShadowRoot ? root.host : null;
      };
      for (let el = up(control); el && texts.length < 12; el = up(el)) {
        texts.push(el.textContent ?? '');
        // Names of the containers, up to (not including) <body>.
        if (el.tagName !== 'BODY' && el.tagName !== 'HTML') names.push(`${el.id} ${el.getAttribute('class') ?? ''}`);
      }
      if (!inConsentContext(texts, names)) return;
      const record = {
        source: 'click' as const,
        choice: kind === 'reject' ? 'rejected' as const : 'accepted' as const,
        at: Date.now(),
        trigger: 'action' as const,
        // Shown in the popup; for a button recognised only by its attributes, its id.
        label: (label || control.id || '?').replace(/\s+/g, ' ').trim().slice(0, 50),
      };
      // Some platforms reload the page right after the choice (arera.it), and the
      // message may be lost with the page. Kept in the page's session storage too, and
      // sent again by the next page of the same site: the background recognises it
      // as the same choice (same time), so it is never counted twice.
      try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(record)); } catch { /* storage blocked */ }
      send(record);
    }, { capture: true });
  },
});
