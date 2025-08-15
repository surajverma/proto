// Background script: resolve the main frame IP (IPv4 / IPv6) and update
// the page action icon (color + label) plus tooltip.

const COLOR_V6 = '#00c853'; // green for IPv6
const COLOR_V4 = '#ff9800'; // orange for IPv4
const COLOR_UNKNOWN = '#9e9e9e'; // gray while resolving / unknown

function getIpVersion(ip) {
  if (!ip) return null;
  if (ip.includes(':')) return 'ipv6';
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return 'ipv4';
  return null;
}

function colorFor(version) {
  switch (version) {
    case 'ipv6': return COLOR_V6;
    case 'ipv4': return COLOR_V4;
    default: return COLOR_UNKNOWN;
  }
}

function isLocalIp(ip) {
  if (!ip) return false;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(ip)) return true; // IPv4 private
  if (/^(fc|fd|fe80:)/i.test(ip)) return true; // IPv6 ULA / link-local
  return false;
}

function makeRoundedIcon(size, color, label) {
  let canvas;
  try { if (typeof OffscreenCanvas !== 'undefined') canvas = new OffscreenCanvas(size, size); } catch (_) {}
  if (!canvas) { canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size; }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const radius = size / 2.5;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (label) {
    const scale = label.length <= 2 ? 0.70 : 0.48; // IPv4/IPv6 => 4 chars
    ctx.font = `bold ${Math.round(size * scale)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, size / 2, size / 2 + 0.5);
  }
  return ctx.getImageData(0, 0, size, size);
}

function buildTitle({ version, ip, url }) {
  const parts = [];
  if (version) parts.push(version === 'ipv6' ? 'IPv6' : 'IPv4'); else parts.push('Resolving IP…');
  if (ip) parts.push(ip + (isLocalIp(ip) ? ' (private)' : ''));
  if (url) {
    try { const u = new URL(url); parts.push(u.protocol.replace(':', '').toUpperCase()); } catch (_) {}
  }
  return parts.join(' | ');
}

function setIcon(tabId, version, ip, url) {
  const label = version ? (version === 'ipv6' ? 'IPv6' : 'IPv4') : '';
  const color = colorFor(version);
  const icon16 = makeRoundedIcon(16, color, label);
  const icon32 = makeRoundedIcon(32, color, label);
  try { browser.pageAction.setIcon({ tabId, imageData: { 16: icon16, 32: icon32 } }); } catch (e) { console.error('setIcon error', e); }
  browser.pageAction.setTitle({ tabId, title: buildTitle({ version, ip, url }) });
  try { browser.pageAction.show(tabId); } catch (_) {}
}

const tabState = new Map();
const pendingFallbackTimers = new Map();
function clearFallbackTimer(tabId) {
  const t = pendingFallbackTimers.get(tabId);
  if (t) { clearTimeout(t); pendingFallbackTimers.delete(tabId); }
}
function rememberState(tabId, version, ip, url) {
  clearFallbackTimer(tabId);
  tabState.set(tabId, { version, ip, url, ts: Date.now() });
}
function getState(tabId) {
  return tabState.get(tabId);
}
function clearState(tabId) {
  tabState.delete(tabId);
  clearFallbackTimer(tabId);
}

browser.webNavigation.onBeforeNavigate.addListener(e => {
  if (e.frameId !== 0) return;
  clearState(e.tabId);
  setIcon(e.tabId, null, null, e.url);
  // Start DNS fallback timer if webRequest doesn't deliver an IP soon (e.g., tabId -1 or HTTP/3)
  clearFallbackTimer(e.tabId);
  pendingFallbackTimers.set(e.tabId, setTimeout(() => {
    dnsFallbackResolve(e.tabId, e.url);
  }, 1800));
});

async function dnsFallbackResolve(tabId, url) {
  try {
    const tab = await browser.tabs.get(tabId).catch(() => null);
    const useUrl = (tab && tab.url) ? tab.url : url;
    if (!useUrl) return;
    const u = new URL(useUrl);
    if (!/^https?:$/i.test(u.protocol)) return;
    // If state already resolved, abort
  if (getState(tabId)) return;
  if (!browser.dns || !browser.dns.resolve) { console.warn('[proto] dns API unavailable'); return; }
  const res = await browser.dns.resolve(u.hostname).catch(err => { console.warn('[proto] dns.resolve failed', err); return null; });
  if (!res || !res.addresses || !res.addresses.length) return;
    const addresses = res.addresses;
    // Choose first IPv6 if any, else first IPv4
    let chosen = addresses.find(a => a.includes(':')) || addresses.find(a => a.includes('.'));
    if (!chosen) return;
    const version = getIpVersion(chosen);
    // Mark as DNS-fallback; we could store all addresses but keep one for display
    rememberState(tabId, version, chosen, useUrl);
    setIcon(tabId, version, chosen, useUrl);
  } finally {
    clearFallbackTimer(tabId);
  }
}

browser.webRequest.onCompleted.addListener(details => {
  console.log('[proto] webRequest.onCompleted', details);
  if (details.type !== 'main_frame') return;
  if (typeof details.tabId !== 'number' || details.tabId < 0) return; // Prevent invalid tabId errors
  if (!('ip' in details)) {
    console.warn('[proto] onCompleted: No IP property in details', details);
  }
  browser.tabs.get(details.tabId, tab => {
    const version = getIpVersion(details.ip);
    const finalUrl = tab ? tab.url : details.url;
    console.log('[proto] tabs.get callback (onCompleted)', { tab, version, ip: details.ip, finalUrl });
    setIcon(details.tabId, version, details.ip, finalUrl);
    if (version) rememberState(details.tabId, version, details.ip, finalUrl);
  });
}, { urls: ['<all_urls>'] });

// Also try onResponseStarted to see if IP is available earlier
browser.webRequest.onResponseStarted.addListener(details => {
  console.log('[proto] webRequest.onResponseStarted', details);
  if (details.type !== 'main_frame') return;
  if (typeof details.tabId !== 'number' || details.tabId < 0) return;
  if (!('ip' in details)) {
    console.warn('[proto] onResponseStarted: No IP property in details', details);
  }
  browser.tabs.get(details.tabId, tab => {
    const version = getIpVersion(details.ip);
    const finalUrl = tab ? tab.url : details.url;
    console.log('[proto] tabs.get callback (onResponseStarted)', { tab, version, ip: details.ip, finalUrl });
    // Do NOT call setIcon/rememberState here yet, just log for now
  });
}, { urls: ['<all_urls>'] });

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && /^https?:/i.test(tab.url)) {
    console.log('[proto] tabs.onUpdated', { tabId, changeInfo, tab });
    const st = getState(tabId);
    if (st && st.version) setIcon(tabId, st.version, st.ip, st.url);
    else if (!st) setIcon(tabId, null, null, tab.url);
  }
});

function initExistingTabs() {
  browser.tabs.query({}).then(tabs => {
    tabs.forEach(t => {
      if (t.url && /^https?:/i.test(t.url)) {
        const st = getState(t.id);
        if (st && st.version) setIcon(t.id, st.version, st.ip, st.url);
        else setIcon(t.id, null, null, t.url);
      }
    });
  }).catch(err => console.error('initExistingTabs error', err));
}
try { browser.runtime.onInstalled.addListener(initExistingTabs); initExistingTabs(); } catch (e) { console.warn('initExistingTabs failed', e); }
browser.tabs.onRemoved.addListener(clearState);

browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.kind === 'getActiveState') {
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      const tab = tabs[0];
      if (!tab) { sendResponse({}); return; }
      const st = getState(tab.id) || { url: tab.url };
      sendResponse(st);
    });
    return true;
  }
});
