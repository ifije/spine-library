const view = document.getElementById('view');
const state = { q: '', topic: 'All', society: 'All', termQ: '', termCat: 'All' };
let D, byId, termIds, deckIds;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cite = p => `${esc(p.lead_author)} ${esc(p.year)}, ${esc(p.journal)}`;
const back = () => '<button class="back" onclick="history.back()">‹ Back</button>';
const field = (label, value) => value ? `<h2>${label}</h2><p>${esc(value)}</p>` : '';

const isPending = p => p.review_depth.startsWith('Citation');

function depth(p) {
  if (p.fulltext_read_end_to_end) return '<span class="badge ok">Full text reviewed</span>';
  if (isPending(p)) return '<span class="badge">Citation only</span>';
  if (p.fulltext_substitute) return '<span class="badge">Abstract + review only</span>';
  return p.review_depth.startsWith('Abstract plus')
    ? '<span class="badge">Abstract + part of full text</span>'
    : '<span class="badge">Abstract only</span>';
}

function paperCard(p) {
  return `<a class="card" href="#/paper/${p.id}"><b>${esc(p.label)}</b>
    <span class="muted small">${isPending(p) ? esc(p.title) : `${cite(p)} · ${esc(p.design)}`}</span><br>${depth(p)}</a>`;
}

function chips(items, active, attr) {
  return `<div class="chips">${items.map(t => `<button class="chip ${t === active ? 'on' : ''}" ${attr}="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
}

function matchPapers() {
  const q = state.q.toLowerCase();
  return D.papers.filter(p => (state.topic === 'All' || p.topic === state.topic)
    && (state.society === 'All' || p.society_groups.includes(state.society))
    && (!q || [p.label, p.title, p.lead_author, p.year, p.topic, p.finding].join(' ').toLowerCase().includes(q)));
}

function renderPaperList() {
  const list = matchPapers();
  document.getElementById('results').innerHTML = `<p class="muted small">${list.length} of ${D.papers.length} papers</p>` + list.map(paperCard).join('');
}

function viewPapers() {
  const topics = ['All', ...new Set(D.papers.map(p => p.topic))];
  const societies = ['All', ...new Set(D.papers.flatMap(p => p.society_groups))].sort((a, b) => (a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b)));
  view.innerHTML = `<h1>Papers</h1><input id="search" type="search" placeholder="Search trial, author, topic" value="${esc(state.q)}">
    ${chips(societies, state.society, 'data-society')}${chips(topics, state.topic, 'data-topic')}<div id="results"></div>`;
  document.getElementById('search').addEventListener('input', e => { state.q = e.target.value; renderPaperList(); });
  view.querySelectorAll('[data-topic]').forEach(b => b.onclick = () => { state.topic = b.dataset.topic; viewPapers(); });
  view.querySelectorAll('[data-society]').forEach(b => b.onclick = () => { state.society = b.dataset.society; viewPapers(); });
  renderPaperList();
}

function viewPaper(id) {
  const p = byId[id];
  if (!p) return notFound();
  const terms = D.glossary.filter(t => t.papers.includes(id));
  const briefs = D.briefs.filter(b => b.papers.includes(id));
  const full = p.drive_url
    ? `<a class="btn" href="${esc(p.drive_url)}" target="_blank" rel="noopener">${p.fulltext_substitute ? 'Open review, not the original' : 'Open full text'}</a>`
    : (p.fulltext_url ? `<a class="btn ghost" href="${esc(p.fulltext_url)}" target="_blank" rel="noopener">Read on PMC</a>` : '');
  const soc = (p.society_links || []).map(s => `<p class="small"><b>${esc(s.group)}</b>: ${esc(s.relationship)}${s.proof_url ? ` · <a href="${esc(s.proof_url)}" target="_blank" rel="noopener">Proof</a>` : ''}</p>`).join('');
  const sub = p.fulltext_substitute;
  const substitute = sub ? `<div class="box">${esc(sub.note)} ${esc(sub.citation)} <a href="${esc(sub.pubmed_url)}" target="_blank" rel="noopener">PubMed</a></div>` : '';
  const problems = p.missing_or_discrepant_fields || [];
  const flags = problems.length ? `<details class="box"><summary>${problems.length} problem${problems.length > 1 ? 's' : ''} found in this source</summary>${problems.map(f => `<p class="small">${esc(f)}</p>`).join('')}</details>` : '';
  view.innerHTML = `${back()}<h1>${esc(p.label)}</h1>
    <p class="muted small">${cite(p)} · ${esc(p.design)}${p.n ? ` · n=${esc(p.n)}` : ''}</p>${depth(p)}
    ${deckIds[id] ? `<a class="btn" href="#/slides/${id}/1">Journal club slides</a>` : ''}${full}
    <p class="small">${esc(p.title)}</p>${substitute}${flags}
    ${isPending(p) ? '<div class="box">Citation verified, but no clinical appraisal yet. No results have been extracted from this paper.</div>'
      : field('Population', p.population) + field('Endpoint', p.endpoint) + field('Follow-up', p.followup)
        + field('Finding', p.finding) + field('Numbers', p.numbers) + field('Limitation', p.caveat)}
    ${p.discussion ? `<h2>In discussion</h2><p class="quote">${esc(p.discussion)}</p>` : ''}
    ${briefs.map(b => `<a class="btn ghost" href="#/brief/${b.id}">Read the debate brief</a>`).join('')}
    ${p.pairs.length ? `<h2>Compare with</h2>${p.pairs.map(o => `<a class="card" href="#/compare/${id}/${o}"><b>${esc(byId[o].label)}</b><span class="muted small">Side by side</span></a>`).join('')}` : ''}
    ${terms.length ? `<h2>Terms</h2><div class="links">${terms.map(t => `<a href="#/term/${t.id}">${esc(t.term)}</a>`).join('')}</div>` : ''}
    ${soc ? `<h2>Curated by</h2>${soc}` : ''}
    <h2>Sources</h2><div class="links"><a href="${esc(p.pubmed_url)}" target="_blank" rel="noopener">PubMed</a>
    ${p.doi ? `<a href="https://doi.org/${esc(p.doi)}" target="_blank" rel="noopener">Publisher</a>` : ''}
    ${p.drive_url && p.fulltext_url ? `<a href="${esc(p.fulltext_url)}" target="_blank" rel="noopener">PMC</a>` : ''}</div>`;
}

function viewCompare(a, b) {
  const x = byId[a], y = byId[b];
  if (!x || !y) return notFound();
  const rows = [['Design', 'design'], ['n', 'n'], ['Population', 'population'], ['Endpoint', 'endpoint'], ['Follow-up', 'followup'],
    ['Finding', 'finding'], ['Numbers', 'numbers'], ['Limitation', 'caveat']];
  view.innerHTML = `${back()}<h1>${esc(x.label)} vs ${esc(y.label)}</h1>
    <p>${depth(x)} ${depth(y)}</p>
    <div class="pair sticky"><b>${esc(x.label)}</b><b>${esc(y.label)}</b></div>
    ${rows.map(([label, k]) => `<div class="row"><h2>${label}</h2><div class="pair"><div>${esc(x[k])}</div><div>${esc(y[k])}</div></div></div>`).join('')}`;
}

function viewCourse() {
  view.innerHTML = `<h1>Course</h1>` + (D.briefs.length ? `<h2>Debate briefs</h2>${D.briefs.map(b => `<a class="card" href="#/brief/${b.id}"><b>${esc(b.title)}</b><span class="muted small">${esc(b.question)}</span></a>`).join('')}<h2>Modules</h2>` : '') + D.curriculum.map(w => `<a class="card" href="#/week/${w.id}">
    <b>${w.week ? `Week ${esc(w.week)}: ` : 'Optional: '}${esc(w.title)}</b>
    <span class="muted small">${esc(w.question)}</span></a>`).join('');
}

function viewWeek(id) {
  const w = D.curriculum.find(x => x.id === id);
  if (!w) return notFound();
  const list = ids => ids.map(i => paperCard(byId[i])).join('');
  view.innerHTML = `${back()}<h1>${esc(w.title)}</h1><p>${esc(w.question)}</p>
    ${w.brief ? `<a class="btn" href="#/brief/${w.brief}">Read the debate brief</a>` : ''}
    ${field('Case', w.case)}${field('Challenge', w.challenge)}
    <h2>Core papers</h2>${list(w.anchors)}
    ${w.additional.length ? `<h2>Further reading</h2>${list(w.additional)}` : ''}
    ${w.historical.length ? `<h2>Historical context</h2>${list(w.historical)}` : ''}`;
}

function viewBrief(id) {
  const b = D.briefs.find(x => x.id === id);
  if (!b) return notFound();
  const { columns, rows } = b.trials;
  const table = rows.map(([label, ...cells]) => `<div class="row"><h2>${esc(label)}</h2>${cells.map((c, i) =>
    `<p class="small"><b>${esc(columns[i])}:</b> ${esc(c)}</p>`).join('')}</div>`).join('');
  view.innerHTML = `${back()}<h1>${esc(b.title)}</h1><p>${esc(b.question)}</p>
    <h2>Say it in 60 seconds</h2><p class="quote">${esc(b.spoken)}</p>
    <h2>Trials side by side</h2>${table}
    <h2>Why they disagree</h2>${b.reasons.map(r => `<p><b>${esc(r.title)}.</b> ${esc(r.text)}</p>`).join('')}
    <h2>Which patient does it apply to?</h2>${b.applies.map(a => `<div class="card"><b>${esc(a.patient)}</b><span class="small">${esc(a.reading)}</span></div>`).join('')}
    <h2>Avoid saying</h2>${b.misstatements.map(m => `<div class="row"><p class="small muted">"${esc(m.wrong)}"</p><p class="small">${esc(m.better)}</p></div>`).join('')}
    <h2>Problems found in the sources</h2>${b.flags.map(f => `<div class="box">${esc(f)}</div>`).join('')}
    <h2>Limits of this brief</h2><p class="small">${esc(b.limits)}</p>
    <h2>Papers</h2>${b.papers.map(i => paperCard(byId[i])).join('')}`;
}

function viewSlides(id, n) {
  const d = deckIds[id], p = byId[id];
  if (!d) return notFound();
  const i = Math.min(Math.max(Number(n) || 1, 1), d.slides.length), s = d.slides[i - 1];
  const table = s.table ? `<div class="scroll"><table><tr>${s.table.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr>
    ${s.table.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>` : '';
  const link = (k, label) => k < 1 || k > d.slides.length ? `<span class="btn ghost off">${label}</span>` : `<a class="btn ghost" href="#/slides/${id}/${k}">${label}</a>`;
  view.innerHTML = `<a class="back" href="#/paper/${id}">‹ ${esc(p.label)}</a><p class="muted small">Slide ${i} of ${d.slides.length}</p>
    <h1>${esc(s.title)}</h1>${s.lead ? `<p class="lead">${esc(s.lead)}</p>` : ''}
    ${s.points && s.points.length ? `<ul>${s.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${table}
    ${s.see ? `<p class="small muted">${esc(s.see)}</p>` : ''}
    <div class="pager">${link(i - 1, 'Back')}${link(i + 1, 'Next')}</div>
    <h2>Teaching notes</h2><p>${esc(s.notes)}</p>
    ${i === d.slides.length && d.not_reviewed ? `<p class="small muted">Not reviewed: ${esc(d.not_reviewed)}</p>` : ''}`;
}

function renderTerms() {
  const q = state.termQ.toLowerCase();
  const list = D.glossary.filter(t => (state.termCat === 'All' || t.category === state.termCat)
    && (!q || (t.term + ' ' + t.definition).toLowerCase().includes(q)));
  document.getElementById('results').innerHTML = list.map(t =>
    `<a class="card" href="#/term/${t.id}"><b>${esc(t.term)}</b><span class="muted small">${esc(t.category)}</span></a>`).join('') || '<p class="muted">No matching terms.</p>';
}

function viewTerms() {
  view.innerHTML = `<h1>Terms</h1><input id="search" type="search" placeholder="Search terms" value="${esc(state.termQ)}">
    ${chips(['All', ...new Set(D.glossary.map(t => t.category))], state.termCat, 'data-cat')}
    <div class="box">Most definitions are starters, not yet checked against the papers. Thresholds vary by source.</div><div id="results"></div>`;
  document.getElementById('search').addEventListener('input', e => { state.termQ = e.target.value; renderTerms(); });
  view.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { state.termCat = b.dataset.cat; viewTerms(); });
  renderTerms();
}

function viewTerm(id) {
  const t = termIds[id];
  if (!t) return notFound();
  view.innerHTML = `${back()}<h1>${esc(t.term)}</h1><p class="muted small">${esc(t.category)}</p>
    ${t.checked ? '<span class="badge ok">Checked against the papers</span>' : '<div class="box">Starter definition, not yet checked against the papers.</div>'}
    <p>${esc(t.definition)}</p><h2>How it's used</h2><p class="quote">${esc(t.usage.replace(/^"|"$/g, ''))}</p>
    ${t.papers.length ? `<h2>Papers</h2>${t.papers.map(i => paperCard(byId[i])).join('')}` : ''}`;
}

function notFound() {
  view.innerHTML = `${back()}<p class="pad">That page doesn't exist.</p>`;
}

function route() {
  const [name, a, b] = location.hash.replace(/^#\/?/, '').split('/');
  const tab = { course: 'course', week: 'course', brief: 'course', slides: 'papers', terms: 'terms', term: 'terms' }[name] || 'papers';
  document.querySelectorAll('#tabs a').forEach(l => l.classList.toggle('on', l.dataset.tab === tab));
  ({ paper: () => viewPaper(a), compare: () => viewCompare(a, b), course: viewCourse, week: () => viewWeek(a), brief: () => viewBrief(a), slides: () => viewSlides(a, b),
    terms: viewTerms, term: () => viewTerm(a) }[name] || viewPapers)();
  window.scrollTo(0, 0);
}

fetch('data.json').then(r => r.json()).then(data => {
  D = data;
  D.papers.sort((a, b) => (b.online_date || String(b.year)).localeCompare(a.online_date || String(a.year)));
  byId = Object.fromEntries(D.papers.map(p => [p.id, p]));
  termIds = Object.fromEntries(D.glossary.map(t => [t.id, t]));
  deckIds = Object.fromEntries((D.decks || []).map(d => [d.id, d]));
  addEventListener('hashchange', route);
  addEventListener('keydown', e => {
    const m = location.hash.match(/^#\/slides\/(\w+)\/(\d+)/), step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!m || !step) return;
    const next = Number(m[2]) + step;
    if (next >= 1 && next <= deckIds[m[1]].slides.length) location.hash = `#/slides/${m[1]}/${next}`;
  });
  route();
}).catch(() => { view.innerHTML = '<p class="pad">Could not load the library. Connect once to download it for offline use.</p>'; });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
