(function () {
  const $ = s => document.querySelector(s);
  const versionEl = $('#version');
  const ipEl = $('#ip');
  const detailsEl = $('#details');
  const statusEl = $('#status');

  function isLocal(ip) {
    if (!ip) return false;
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(ip)) return true;
    if (/^(fc|fd|fe80:)/i.test(ip)) return true;
    return false;
  }

  function colorClass(version) {
    return version === 'ipv6' ? 'ipv6' : version === 'ipv4' ? 'ipv4' : '';
  }

  function render(state) {
    const { version, ip, url } = state || {};
    versionEl.textContent = version ? (version === 'ipv6' ? 'IPv6' : 'IPv4') : '…';
    versionEl.className = 'badge ' + colorClass(version);
    // Large IP line
    ipEl.textContent = ip || 'Resolving…';
    if (ip && isLocal(ip)) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = 'PRIVATE';
      chip.style.marginLeft = '6px';
      ipEl.appendChild(chip);
    }
    detailsEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    function row(label, value, extraChip) {
      const dt = document.createElement('dt'); dt.textContent = label;
      const dd = document.createElement('dd'); dd.textContent = value;
      if (extraChip) { const chip = document.createElement('span'); chip.className = 'chip'; chip.textContent = extraChip; dd.appendChild(chip); }
      frag.appendChild(dt); frag.appendChild(dd);
    }
    if (url) {
      try { const u = new URL(url); row('Protocol', u.protocol.replace(':','').toUpperCase()); } catch (_) {}
    }
    if (ip) {
      row('Version', version ? version.toUpperCase() : '?');
    }
    detailsEl.appendChild(frag);
  }

  function loadState() { return browser.runtime.sendMessage({ kind: 'getActiveState' }); }

  loadState().then(render).catch(e => {
    statusEl.textContent = 'Cannot load IP info';
    console.error(e);
  });
})();
