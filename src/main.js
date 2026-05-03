import './style.css'
import {
  getDecks, saveDeck, deleteDeck,
  getProgress, getCardState, setCardState,
  getSessionCount, bumpSessionCount,
} from './storage.js'
import {
  today, getDueCards, getDeckStats, nextBox,
} from './leitner.js'

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  view: 'home',
  deck: null,
  queue: [],
  queueIdx: 0,
  flipped: false,
  sessionCorrect: 0,
  sessionTotal: 0,
}

const root = document.getElementById('app')

// ── Router ────────────────────────────────────────────────────────────────────
function navigate(view, params = {}) {
  Object.assign(state, { view, flipped: false, ...params })
  render()
}

// ── Render dispatch ───────────────────────────────────────────────────────────
function render() {
  if (state.view === 'home')         renderHome()
  else if (state.view === 'study')   renderStudy()
  else if (state.view === 'summary') renderSummary()
}

// ── Home ──────────────────────────────────────────────────────────────────────
function renderHome() {
  const decks = getDecks()
  const deckList = Object.values(decks)

  root.innerHTML = `
    <div class="screen home-screen">
      <header class="app-header">
        <div class="logo">
          <span class="logo-icon">◈</span>
          <span class="logo-text">Zettelkasten</span>
        </div>
        <label class="btn btn-primary import-btn" tabindex="0">
          <span>+ Deck importieren</span>
          <input type="file" id="file-import" accept=".json" style="display:none" />
        </label>
      </header>

      <main class="home-main">
        ${deckList.length === 0 ? renderEmptyState() : renderDeckGrid(deckList)}
      </main>

      <footer class="app-footer">
        <span>Leitner 5-Fach · 20 Karten/Tag</span>
      </footer>
    </div>
  `

  document.getElementById('file-import').addEventListener('change', handleImport)
}

function renderEmptyState() {
  return `
    <div class="empty-state">
      <div class="empty-icon">◈</div>
      <h2>Noch keine Decks</h2>
      <p>Importiere ein Deck als JSON-Datei, um loszulegen.</p>
      <div class="empty-format">
        <p class="format-label">Deck-Format:</p>
        <pre class="format-code">{
  "name": "Biologie Zelle",
  "id": "bio-zelle",
  "cards": [
    {
      "id": "card-001",
      "front": "Was ist eine Zelle?",
      "back": "Die kleinste Einheit des Lebens."
    }
  ]
}</pre>
      </div>
    </div>
  `
}

function renderDeckGrid(deckList) {
  return `
    <div class="deck-grid">
      ${deckList.map(deck => renderDeckCard(deck)).join('')}
    </div>
  `
}

function renderDeckCard(deck) {
  const progress = getProgress(deck.id)
  const stats = getDeckStats(deck, progress)
  const session = getSessionCount(deck.id, today())
  const masteredPct = deck.cards.length > 0
    ? Math.round((stats.mastered / deck.cards.length) * 100) : 0
  const budgetLeft = Math.max(0, 20 - session.studied)
  const dueNow = Math.min(stats.dueCount, budgetLeft)
  const canStudy = dueNow > 0

  return `
    <div class="deck-card">
      <div class="deck-card-body">
        <div class="deck-name">${escHtml(deck.name)}</div>
        <div class="deck-meta">
          <span>${stats.total} Karten</span>
          <span class="sep">·</span>
          <span>${masteredPct}% beherrscht</span>
        </div>
        ${renderBoxBar(stats.boxCounts, deck.cards.length)}
        <div class="deck-due">
          ${canStudy
            ? `<span class="due-badge">${dueNow} heute fällig</span>`
            : session.studied >= 20
              ? `<span class="done-badge">Tageslimit ✓</span>`
              : `<span class="uptodate-badge">Alles erledigt ✓</span>`
          }
          ${session.studied > 0
            ? `<span class="studied-today">${session.studied} heute gelernt</span>` : ''}
        </div>
      </div>
      <div class="deck-card-actions">
        <button
          class="btn btn-study ${canStudy ? '' : 'btn-disabled'}"
          data-action="study" data-deck-id="${deck.id}"
          ${canStudy ? '' : 'disabled'}>
          ${canStudy ? 'Lernen' : 'Fertig'}
        </button>
        <button class="btn btn-ghost btn-delete"
          data-action="delete" data-deck-id="${deck.id}"
          title="Deck löschen">✕</button>
      </div>
    </div>
  `
}

function renderBoxBar(boxCounts, total) {
  if (total === 0) return ''
  const colors = ['', '#e88c7a', '#e8c07a', '#d4d07a', '#8ec98c', '#5b9e6b']
  const segs = [1, 2, 3, 4, 5].map(box => {
    const pct = total > 0 ? ((boxCounts[box] || 0) / total * 100).toFixed(1) : 0
    if (pct == 0) return ''
    return `<div class="box-bar-seg" style="width:${pct}%;background:${colors[box]}"
      title="Fach ${box}: ${boxCounts[box] || 0} Karten"></div>`
  }).join('')
  return `<div class="box-bar">${segs ||
    '<div class="box-bar-seg" style="width:100%;background:#e2d8cf"></div>'}</div>`
}

// ── Study ─────────────────────────────────────────────────────────────────────
function renderStudy() {
  const { deck, queue, queueIdx, flipped } = state
  if (queueIdx >= queue.length) { navigate('summary'); return }

  const card = queue[queueIdx]
  const cardState = getCardState(deck.id, card.id)

  root.innerHTML = `
    <div class="screen study-screen">
      <header class="study-header">
        <button class="btn btn-ghost back-btn" id="back-home">← Zurück</button>
        <div class="study-deck-name">${escHtml(deck.name)}</div>
        <div class="study-progress-text">${queueIdx + 1} / ${queue.length}</div>
      </header>

      <div class="study-progress-bar">
        <div class="study-progress-fill"
          style="width:${(queueIdx / queue.length) * 100}%"></div>
      </div>

      <main class="study-main">
        <div class="box-indicator">
          ${[1,2,3,4,5].map(b =>
            `<div class="box-dot ${b === cardState.box ? 'active' : b < cardState.box ? 'done' : ''}"></div>`
          ).join('')}
          <span class="box-label">Fach ${cardState.box}</span>
        </div>

        <div class="card-scene" id="card-scene">
          <div class="card-flip ${flipped ? 'is-flipped' : ''}" id="card-flip">
            <div class="card-face card-front">
              <div class="card-content">
                <div class="card-face-label">Frage</div>
                <div class="card-text">${renderMarkdown(card.front)}</div>
              </div>
              <button class="btn btn-reveal" id="reveal-btn">Antwort zeigen</button>
            </div>
            <div class="card-face card-back">
              <div class="card-content">
                <div class="card-face-label">Antwort</div>
                <div class="card-text">${renderMarkdown(card.back)}</div>
              </div>
              <div class="answer-buttons">
                <button class="btn btn-wrong" id="btn-wrong">✗ Nochmal</button>
                <button class="btn btn-correct" id="btn-correct">✓ Gewusst</button>
              </div>
            </div>
          </div>
        </div>

        <div class="study-hint" id="study-hint">
          ${flipped ? '' : 'Karte antippen oder "Antwort zeigen"'}
        </div>
      </main>
    </div>
  `

  document.getElementById('back-home').addEventListener('click', () => navigate('home'))

  document.getElementById('card-scene').addEventListener('click', e => {
    if (!state.flipped && !e.target.closest('button')) flipCard()
  })

  const revealBtn = document.getElementById('reveal-btn')
  if (revealBtn) revealBtn.addEventListener('click', flipCard)

  document.getElementById('btn-wrong')?.addEventListener('click', () => answerCard(false))
  document.getElementById('btn-correct')?.addEventListener('click', () => answerCard(true))
}

function flipCard() {
  if (state.flipped) return
  state.flipped = true
  document.getElementById('card-flip')?.classList.add('is-flipped')
  const hint = document.getElementById('study-hint')
  if (hint) hint.textContent = ''
}

function answerCard(correct) {
  const { deck, queue, queueIdx } = state
  const card = queue[queueIdx]
  const cardState = getCardState(deck.id, card.id)
  const newBox = nextBox(cardState.box, correct)

  setCardState(deck.id, card.id, { box: newBox, lastReviewed: today() })
  bumpSessionCount(deck.id, today(), correct)

  if (correct) state.sessionCorrect++
  state.sessionTotal++
  state.queueIdx++
  state.flipped = false
  render()
}

// ── Summary ───────────────────────────────────────────────────────────────────
function renderSummary() {
  const { deck, sessionCorrect, sessionTotal } = state
  const progress = getProgress(deck.id)
  const stats = getDeckStats(deck, progress)
  const pct = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0
  const masteredPct = deck.cards.length > 0
    ? Math.round((stats.mastered / deck.cards.length) * 100) : 0

  const message = pct >= 90 ? 'Ausgezeichnet! 🎉'
    : pct >= 70 ? 'Sehr gut gemacht!'
    : pct >= 50 ? 'Weiter so!'
    : 'Übung macht den Meister.'

  root.innerHTML = `
    <div class="screen summary-screen">
      <div class="summary-card">
        <div class="summary-icon">◈</div>
        <h1 class="summary-title">${message}</h1>
        <div class="summary-stats">
          <div class="stat-item">
            <div class="stat-num">${sessionTotal}</div>
            <div class="stat-lbl">Gelernt</div>
          </div>
          <div class="stat-item stat-green">
            <div class="stat-num">${sessionCorrect}</div>
            <div class="stat-lbl">Gewusst</div>
          </div>
          <div class="stat-item stat-red">
            <div class="stat-num">${sessionTotal - sessionCorrect}</div>
            <div class="stat-lbl">Wiederholen</div>
          </div>
        </div>
        <div class="summary-pct">${pct}% richtig</div>
        <div class="summary-bar-wrap">
          <div class="summary-bar">
            <div class="summary-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>
        <div class="summary-mastered">${masteredPct}% des Decks beherrscht</div>
        <button class="btn btn-primary" id="btn-home">Zur Übersicht</button>
      </div>
    </div>
  `

  document.getElementById('btn-home').addEventListener('click', () => navigate('home'))
}

// ── Import ────────────────────────────────────────────────────────────────────
async function handleImport(e) {
  const file = e.target.files[0]
  if (!file) return

  try {
    const text = await file.text()
    const data = JSON.parse(text)

    if (!data.name || !Array.isArray(data.cards)) {
      showToast('Ungültiges Format. Brauche "name" und "cards".', 'error')
      return
    }
    if (!data.cards.every(c => c.id && c.front && c.back)) {
      showToast('Jede Karte braucht "id", "front" und "back".', 'error')
      return
    }

    const deck = {
      id: data.id || `deck_${Date.now()}`,
      name: data.name,
      cards: data.cards,
      importedAt: new Date().toISOString(),
    }
    saveDeck(deck)
    showToast(`"${deck.name}" importiert — ${deck.cards.length} Karten`, 'success')
    render()
  } catch {
    showToast('Fehler beim Lesen der Datei.', 'error')
  }

  e.target.value = ''
}

// ── Event delegation (home buttons) ──────────────────────────────────────────
document.addEventListener('click', e => {
  const action = e.target.closest('[data-action]')
  if (!action) return
  const { action: act, deckId } = action.dataset
  if (act === 'study')  startStudy(deckId)
  if (act === 'delete') confirmDelete(deckId)
})

function startStudy(deckId) {
  const deck = getDecks()[deckId]
  if (!deck) return
  const progress = getProgress(deckId)
  const session = getSessionCount(deckId, today())
  const queue = getDueCards(deck, progress, session.studied)
  if (!queue.length) { showToast('Keine fälligen Karten — super!', 'success'); return }
  navigate('study', { deck, queue, queueIdx: 0, flipped: false,
    sessionCorrect: 0, sessionTotal: 0 })
}

function confirmDelete(deckId) {
  const deck = getDecks()[deckId]
  if (!deck) return
  if (confirm(`"${deck.name}" löschen? Alle Fortschritte gehen verloren.`)) {
    deleteDeck(deckId)
    showToast(`"${deck.name}" gelöscht.`)
    render()
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  document.getElementById('toast')?.remove()
  const t = document.createElement('div')
  t.id = 'toast'
  t.className = `toast toast-${type}`
  t.textContent = msg
  document.body.appendChild(t)
  requestAnimationFrame(() => t.classList.add('toast-show'))
  setTimeout(() => { t.classList.remove('toast-show'); setTimeout(() => t.remove(), 300) }, 2800)
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function renderMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code>$1</code>')
    .replace(/\n/g,'<br>')
}

// ── Init ──────────────────────────────────────────────────────────────────────
render()
