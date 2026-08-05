(() => {
  'use strict';

  const EXCLUDE_KEY = 'camp-analytics-exclude';
  const VISITOR_KEY = 'camp-analytics-visitor-id';
  const SESSION_KEY = 'camp-analytics-session-id';
  const SESSION_LAST_KEY = 'camp-analytics-session-last';
  const SESSION_SOURCE_KEY = 'camp-analytics-session-source';
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  const VIEW_DEDUP_MS = 15 * 1000;
  const HEARTBEAT_SECONDS = 15;

  let controller = null;

  function randomId() {
    return crypto.randomUUID?.()
      || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }

  function validId(value) {
    return /^[a-z0-9-]{16,90}$/i.test(String(value || ''));
  }

  function excluded() {
    try { return localStorage.getItem(EXCLUDE_KEY) === '1'; }
    catch { return false; }
  }

  function visitorId() {
    try {
      let id = localStorage.getItem(VISITOR_KEY) || '';
      if (!validId(id)) {
        id = randomId();
        localStorage.setItem(VISITOR_KEY, id);
      }
      return id;
    } catch {
      return randomId();
    }
  }

  function classifySource() {
    const params = new URLSearchParams(location.search);
    const campaign = String(params.get('utm_source') || '').trim().toLowerCase();
    if (campaign) return campaign.replace(/[^a-z0-9_-]/g, '').slice(0, 50) || 'campaign';

    let referrer;
    try { referrer = document.referrer ? new URL(document.referrer) : null; }
    catch { referrer = null; }

    if (!referrer || referrer.origin === location.origin) return 'direct';
    const host = referrer.hostname.toLowerCase();
    if (host.includes('google.')) return 'google';
    if (host.includes('whatsapp') || host === 'wa.me') return 'whatsapp';
    if (host.includes('facebook') || host.includes('fb.')) return 'facebook';
    if (host.includes('instagram')) return 'instagram';
    if (host.includes('t.me') || host.includes('telegram')) return 'telegram';
    return 'other';
  }

  function deviceType() {
    const ua = navigator.userAgent || '';
    if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'tablet';
    if (/Mobi|Android|iPhone|iPod/i.test(ua) || matchMedia('(max-width: 760px)').matches) return 'mobile';
    return 'desktop';
  }

  function sessionInfo() {
    const now = Date.now();
    try {
      let id = localStorage.getItem(SESSION_KEY) || '';
      const last = Number(localStorage.getItem(SESSION_LAST_KEY) || 0);
      let source = localStorage.getItem(SESSION_SOURCE_KEY) || '';
      if (!validId(id) || !last || now - last > SESSION_TIMEOUT_MS) {
        id = randomId();
        source = classifySource();
        localStorage.setItem(SESSION_KEY, id);
        localStorage.setItem(SESSION_SOURCE_KEY, source);
      }
      localStorage.setItem(SESSION_LAST_KEY, String(now));
      return { id, source: source || 'direct' };
    } catch {
      return { id: randomId(), source: classifySource() };
    }
  }

  function touchSession() {
    try { localStorage.setItem(SESSION_LAST_KEY, String(Date.now())); }
    catch {}
  }

  function pageViewAllowed(sessionId, page) {
    try {
      const key = `camp-analytics-view:${sessionId}:${page}`;
      const now = Date.now();
      const previous = Number(sessionStorage.getItem(key) || 0);
      if (previous && now - previous < VIEW_DEDUP_MS) return false;
      sessionStorage.setItem(key, String(now));
      return true;
    } catch {
      return true;
    }
  }

  function safePageTitle() {
    return String(document.title || location.pathname || '/').slice(0, 180);
  }

  function basePayload(page) {
    const session = sessionInfo();
    return {
      visitor_id: visitorId(),
      session_id: session.id,
      page: String(page || location.pathname || '/'),
      page_title: safePageTitle(),
      source: session.source,
      device: deviceType()
    };
  }

  async function send(payload, { beacon = false } = {}) {
    if (excluded()) return false;
    touchSession();
    const body = JSON.stringify(payload);

    if (beacon && navigator.sendBeacon) {
      try {
        if (navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }))) return true;
      } catch {}
    }

    try {
      await fetch('/api/track', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
        credentials: 'same-origin'
      });
      return true;
    } catch {
      return false;
    }
  }

  function currentScrollPercent() {
    const root = document.documentElement;
    const height = Math.max(root.scrollHeight, document.body?.scrollHeight || 0) - innerHeight;
    if (height <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round((scrollY / height) * 100)));
  }

  function start(page = location.pathname || '/') {
    if (excluded()) return null;
    if (controller) return controller;

    const pageKey = String(page || '/');
    const initial = basePayload(pageKey);
    if (pageViewAllowed(initial.session_id, pageKey)) {
      send({ ...initial, event: 'page_view' });
    }

    let pendingSeconds = 0;
    let maxScroll = currentScrollPercent();
    let destroyed = false;

    const updateScroll = () => {
      maxScroll = Math.max(maxScroll, currentScrollPercent());
    };

    const flush = ({ beacon = false, force = false } = {}) => {
      if (destroyed) return;
      if (!force && pendingSeconds < 1) return;
      const seconds = Math.min(60, pendingSeconds);
      pendingSeconds -= seconds;
      send({
        ...basePayload(pageKey),
        event: 'heartbeat',
        engaged_seconds: seconds,
        max_scroll: maxScroll
      }, { beacon });
      if (pendingSeconds > 0) flush({ beacon, force: true });
    };

    const secondTimer = setInterval(() => {
      if (document.visibilityState === 'visible') pendingSeconds += 1;
    }, 1000);

    const heartbeatTimer = setInterval(() => {
      if (document.visibilityState === 'visible') flush({ force: true });
    }, HEARTBEAT_SECONDS * 1000);

    addEventListener('scroll', updateScroll, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush({ beacon: true, force: true });
      else flush({ force: true });
    });
    addEventListener('pagehide', () => {
      flush({ beacon: true, force: true });
      destroyed = true;
      clearInterval(secondTimer);
      clearInterval(heartbeatTimer);
    }, { once: true });

    controller = { page: pageKey, flush };
    return controller;
  }

  function content(contentType, contentKey, contentLabel, contentEvent, value = 1, options = {}) {
    if (excluded()) return;
    const page = controller?.page || location.pathname || '/';
    send({
      ...basePayload(page),
      event: 'content',
      content_type: String(contentType || 'other'),
      content_key: String(contentKey || 'unknown').slice(0, 220),
      content_label: String(contentLabel || contentKey || 'תוכן').slice(0, 180),
      content_event: String(contentEvent || 'interaction'),
      value: Number(value) || 0
    }, options);
  }

  function resolved(value, element) {
    return typeof value === 'function' ? value(element) : value;
  }

  function bindMedia(element, options = {}) {
    if (!element || element.dataset.analyticsBound === '1') return;
    element.dataset.analyticsBound = '1';

    let identity = '';
    let marks = new Set();
    let seconds = 0;
    let timer = null;

    const info = () => {
      const type = String(resolved(options.type, element) || (element.tagName === 'AUDIO' ? 'audio' : 'video'));
      const key = String(resolved(options.key, element) || element.currentSrc || element.src || 'media').slice(0, 220);
      const label = String(resolved(options.label, element) || element.getAttribute('aria-label') || key).slice(0, 180);
      const nextIdentity = `${type}:${key}`;
      if (identity !== nextIdentity) {
        identity = nextIdentity;
        marks = new Set();
        seconds = 0;
      }
      return { type, key, label };
    };

    const sendMark = (event, value = 1) => {
      const media = info();
      content(media.type, media.key, media.label, event, value);
    };

    const flushSeconds = ({ beacon = false } = {}) => {
      if (seconds < 1) return;
      const media = info();
      const event = media.type === 'audio' ? 'listen_seconds' : 'watch_seconds';
      const value = seconds;
      seconds = 0;
      content(media.type, media.key, media.label, event, value, { beacon });
    };

    const startTimer = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (!element.paused && !element.ended && document.visibilityState === 'visible') seconds += 1;
        if (seconds >= HEARTBEAT_SECONDS) flushSeconds();
      }, 1000);
    };

    const stopTimer = () => {
      if (timer) clearInterval(timer);
      timer = null;
      flushSeconds();
    };

    element.addEventListener('play', () => {
      info();
      if (!marks.has('start')) {
        marks.add('start');
        sendMark('start');
      }
      startTimer();
    });

    element.addEventListener('timeupdate', () => {
      const duration = Number(element.duration || 0);
      if (!duration || !Number.isFinite(duration)) return;
      const percent = (Number(element.currentTime || 0) / duration) * 100;
      for (const [threshold, event] of [[25, 'q25'], [50, 'q50'], [75, 'q75']]) {
        if (percent >= threshold && !marks.has(event)) {
          marks.add(event);
          sendMark(event);
        }
      }
    });

    element.addEventListener('pause', stopTimer);
    element.addEventListener('ended', () => {
      stopTimer();
      if (!marks.has('complete')) {
        marks.add('complete');
        sendMark('complete');
      }
    });
    element.addEventListener('emptied', () => {
      stopTimer();
      identity = '';
      marks = new Set();
    });
    addEventListener('pagehide', () => flushSeconds({ beacon: true }), { once: true });
  }

  window.CampAnalytics = Object.freeze({
    start,
    content,
    bindMedia,
    excluded,
    visitorId
  });
})();
