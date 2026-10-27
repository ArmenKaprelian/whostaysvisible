// The atlas's texts in a fixed walk of states (round 17): for tools/page-probe.py --js-file, at a fixed window. Two builds whose page text is
// identical give identical JSON (compare with cmp); a content edit shows as the strings it changed. It reads, through the page's own hooks and
// the DOM, the legend (title, key side, reading side), the NOTE, the METHOD block and the layer's provenance, the year row and the red
// button's label and title, the mix box, the view link, the tile and the Under the cursor panel after a hover, every card's reading block, the
// wire's cycle for three places, the profiles, the tips, the REFERENCES panel's text, the TEACH YOUR AGENT guide, the footer and the presets'
// titles. Nothing is written into the page.
(async () => {
  const A = window.__atlas, $ = id => document.getElementById(id), tx = el => (el ? el.innerText.replace(/\s+\n/g, '\n').trim() : null);
  await A.ready();
  for (const L of ['shared', 'gs']) { A.layer(L); await A.ready(); await new Promise(r => setTimeout(r, 1500)); }   // the files these layers load on first use (shared.js, shared-city.js, groups.js) are in before the walk: ready() does not wait for them
  for (const b of document.querySelectorAll('.btn.info')) if (b.getAttribute('aria-expanded') === 'false') b.click();   // every reading block open
  A.legend(true);
  const out = { states: {}, fixed: {} };
  const legendText = () => { const li = $('legendinfo'); const key = tx($('legendbody')); let read = null; if (li && !li.hidden) { li.click(); read = tx($('legendbody')); li.click(); } return { title: tx($('legendtitle')), key, read }; };
  const hoverAt = (where) => { const c = A.cities[where]; A.hoverKm(c[0], c[1], { show: true }); };
  for (const mode of ['cells', 'firms']) for (const L of A.layers) for (const y of [2014, 2021, 2024, 2025]) for (const p of ['Russia', 'Moscow']) {
    A.mode(mode); A.layer(L); A.year(y); A.preset(p); await A.ready(); if (A.pulseAt) A.pulseAt(null);
    const s = { legend: legendText(), note: tx($('notebody')), prov: tx($('layerprov')), intro: tx($('methodintro')), read: tx($('methodread')),
      yearRow: $('year') ? getComputedStyle($('year').closest('.yearrow') || $('year')).display : null, pulse: $('pulse') ? [$('pulse').title, $('pulse').disabled, tx($('pulselabel'))] : null,
      mix: tx($('mixbox')), hash: A.viewHash ? A.viewHash() : location.hash, tiles: {} };
    for (const where of (p === 'Russia' ? ['Moscow', 'Novosibirsk'] : ['Moscow'])) { hoverAt(where); await new Promise(r => setTimeout(r, 30)); s.tiles[where] = { tip: tx($('tip')), panel: tx($('cellinfo')) }; }
    if (A.hoverOff) A.hoverOff();
    out.states[[mode, L, y, p].join('/')] = s;
  }
  for (const id of ['cr-goto', 'cr-cursor', 'cr-odds', 'cr-national', 'cr-groups', 'mixread']) out.fixed[id] = tx($(id));
  out.fixed.wire = {}; for (const y of [2014, 2021, 2024, 2025]) for (const r of ['Russia', 'Moscow Oblast', 'Novosibirsk Oblast']) out.fixed.wire[y + '/' + r] = A.wireAt(y, r).map(it => it.kind + ': ' + it.text);
  out.fixed.profiles = A.profiles ? A.profiles() : null;
  out.fixed.tips = A.tipTexts ? A.tipTexts() : null;
  $('refsbtn').click(); await new Promise(r => setTimeout(r, 400)); out.fixed.refs = tx($('refs')); if ($('refsclose')) $('refsclose').click();
  out.fixed.guide = typeof AGENT_GUIDE !== 'undefined' ? AGENT_GUIDE : (window.AGENT_GUIDE || null);
  out.fixed.footer = tx(document.querySelector('footer'));
  out.fixed.presets = [...document.querySelectorAll('#presets .btn')].map(b => [b.textContent.trim(), b.title]);
  out.fixed.header = tx(document.querySelector('header'));
  return out;
})()
