import './style.css'
import {
  getDecks, saveDeck, deleteDeck,
  getFolders, saveFolder, deleteFolder,
  getProgress, getCardState, setCardState,
  getSessionCount, bumpSessionCount,
  getDeckSettings, saveDeckSettings,
  resetDeckProgress,
} from './storage.js'
import { today, getDueCards, getAllCardsSorted, getDeckStats, nextBox, DAILY_BUDGET } from './leitner.js'

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  view: 'home',
  deck: null,
  queue: [],
  queueIdx: 0,
  flipped: false,
  sessionGrades: [],   // array of grade (0-3) per card
  limitOverride: false,
  activeFolderId: null, // null = all
}

const root = document.getElementById('app')

function navigate(view, params = {}) {
  Object.assign(state, { view, flipped: false, ...params })
  render()
}

function render() {
  if (state.view === 'home')         renderHome()
  else if (state.view === 'study')   renderStudy()
  else if (state.view === 'summary') renderSummary()
}

// ── Folder colors ─────────────────────────────────────────────────────────────
const FOLDER_COLORS = [
  { id: 'amber',  label: 'Amber',  bg: 'oklch(0.92 0.08 75)',  text: 'oklch(0.45 0.15 65)'  },
  { id: 'green',  label: 'Grün',   bg: 'oklch(0.92 0.07 145)', text: 'oklch(0.4 0.13 145)'  },
  { id: 'blue',   label: 'Blau',   bg: 'oklch(0.92 0.07 240)', text: 'oklch(0.4 0.13 240)'  },
  { id: 'purple', label: 'Lila',   bg: 'oklch(0.92 0.07 300)', text: 'oklch(0.4 0.12 300)'  },
  { id: 'red',    label: 'Rot',    bg: 'oklch(0.93 0.07 25)',  text: 'oklch(0.4 0.14 25)'   },
]
function folderColor(colorId) {
  return FOLDER_COLORS.find(c => c.id === colorId) ?? FOLDER_COLORS[0]
}

// ── Home ──────────────────────────────────────────────────────────────────────
function renderHome() {
  const decks   = getDecks()
  const folders = getFolders()
  const allDecks = Object.values(decks)

  const visibleDecks = state.activeFolderId
    ? allDecks.filter(d => d.folderId === state.activeFolderId)
    : allDecks

  root.innerHTML = `
    <div class="screen home-screen">
      <header class="app-header">
        <div class="logo"><span class="logo-icon">◈</span><span class="logo-text">Zettelkasten</span></div>
        <label class="btn btn-primary import-btn" tabindex="0">
          <span>+ Deck importieren</span>
          <input type="file" id="file-import" accept=".json,.txt" style="display:none" />
        </label>
      </header>

      <!-- Folder tabs -->
      <nav class="folder-tabs">
        <button class="folder-tab ${!state.activeFolderId ? 'active' : ''}" data-action="filter-folder" data-folder-id="">
          Alle <span class="folder-tab-count">${allDecks.length}</span>
        </button>
        ${folders.map(f => {
          const col   = folderColor(f.color)
          const count = allDecks.filter(d => d.folderId === f.id).length
          const isActive = state.activeFolderId === f.id
          return `
            <div class="folder-tab-wrap">
              <button class="folder-tab ${isActive ? 'active' : ''}"
                data-action="filter-folder" data-folder-id="${f.id}"
                style="${isActive ? `--tab-bg:${col.bg};--tab-color:${col.text}` : `--tab-dot:${col.text}`}">
                <span class="folder-tab-dot" style="background:${col.text}"></span>
                ${escHtml(f.name)}
                <span class="folder-tab-count">${count}</span>
              </button>
              <button class="folder-tab-del" data-action="delete-folder" data-folder-id="${f.id}" title="Löschen">✕</button>
            </div>
          `
        }).join('')}
        <button class="folder-tab-new" data-action="new-folder">+ Ordner</button>
      </nav>

      <!-- Main: Decks -->
      <main class="home-main">
        ${visibleDecks.length === 0 ? renderEmptyState(!!state.activeFolderId) : `
          <div class="deck-grid">
            ${visibleDecks.map(deck => renderDeckCard(deck, folders)).join('')}
          </div>
        `}
      </main>

      <footer class="app-footer">Leitner 5-Fach · ${DAILY_BUDGET} Karten/Tag</footer>
    </div>
  `

  document.getElementById('file-import').addEventListener('change', handleImport)
}

function renderEmptyState(inFolder) {
  return `
    <div class="empty-state">
      <div class="empty-icon">◈</div>
      <h2>${inFolder ? 'Ordner ist leer' : 'Noch keine Decks'}</h2>
      <p>${inFolder ? 'Decks per Drag-Menü in diesen Ordner verschieben.' : 'Importiere ein Deck als JSON-Datei.'}</p>
      ${!inFolder ? `
        <div class="empty-format">
          <p class="format-label">Deck-Format:</p>
          <pre class="format-code">{
  "id": "bio-zelle",
  "name": "Biologie — Zelle",
  "fach": "Biologie",
  "cards": [
    { "id": "c1", "front": "Frage", "back": "Antwort" }
  ]
}</pre>
        </div>` : ''}
    </div>
  `
}

function renderDeckCard(deck, folders) {
  const progress   = getProgress(deck.id)
  const stats      = getDeckStats(deck, progress)
  const session    = getSessionCount(deck.id, today())
  const settings   = getDeckSettings(deck.id)
  const total      = deck.cards.length
  const securePct  = total > 0
    ? Math.round(((stats.boxCounts[4]||0) + (stats.boxCounts[5]||0)) / total * 100)
    : 0
  const barColor   = securePct >= 66
    ? 'oklch(0.55 0.13 145)'   // green
    : securePct >= 33
      ? 'oklch(0.68 0.14 65)'  // amber
      : 'oklch(0.55 0.14 25)'  // red
  const budgetLeft = Math.max(0, DAILY_BUDGET - session.studied)
  const dueNow     = Math.min(stats.dueCount, budgetLeft)
  const canStudy   = dueNow > 0 || (state.limitOverride && stats.dueCount > 0)
  const hasCards   = total > 0

  const folder = deck.folderId ? folders.find(f => f.id === deck.folderId) : null
  const col    = folder ? folderColor(folder.color) : null

  return `
    <div class="deck-card">
      <div class="deck-card-body">
        <div class="deck-card-top">
          <div class="deck-name">${escHtml(deck.name)}</div>
          ${deck.fach ? `<span class="deck-fach">${escHtml(deck.fach)}</span>` : ''}
        </div>
        ${folder ? `<div class="deck-folder-tag" style="background:${col.bg};color:${col.text}">${escHtml(folder.name)}</div>` : ''}
        <div class="deck-secure-row">
          <span class="secure-pct" style="color:${barColor}">${securePct}%</span>
          <span class="secure-label">sicher</span>
          <div class="secure-bar">
            <div class="secure-bar-fill" style="width:${securePct}%;background:${barColor}"></div>
          </div>
        </div>
        <div class="deck-due-row">
          ${dueNow > 0
            ? `<span class="due-badge">${dueNow} fällig</span>`
            : stats.dueCount === 0
              ? `<span class="uptodate-badge">Erledigt ✓</span>`
              : `<span class="done-badge">Limit ✓</span>`
          }
          <label class="reverse-toggle" title="Vorder/Rückseite tauschen">
            <input type="checkbox" class="reverse-cb" data-deck-id="${deck.id}"
              ${settings.reversed ? 'checked' : ''} />
            ⇄
          </label>
        </div>
      </div>
      <div class="deck-card-actions">
        <select class="deck-folder-select" data-action="move-deck" data-deck-id="${deck.id}">
          <option value="">Kein Ordner</option>
          ${folders.map(f => `<option value="${f.id}" ${deck.folderId === f.id ? 'selected' : ''}>${escHtml(f.name)}</option>`).join('')}
        </select>
        ${hasCards ? `<button class="btn btn-study-all" data-action="study-all" data-deck-id="${deck.id}">Alles üben</button>` : ''}
        <button class="btn btn-study ${canStudy ? '' : 'btn-disabled'}"
          data-action="study" data-deck-id="${deck.id}" ${canStudy ? '' : 'disabled'}>
          ${canStudy ? 'Lernen' : 'Fertig'}
        </button>
        <button class="btn btn-ghost btn-reset" data-action="reset" data-deck-id="${deck.id}" title="Fortschritt zurücksetzen">↺</button>
        <button class="btn btn-ghost btn-delete" data-action="delete" data-deck-id="${deck.id}" title="Löschen">✕</button>
      </div>
    </div>
  `
}

function renderBoxBar(boxCounts, total) {
  if (total === 0) return ''
  const colors = ['', '#e88c7a', '#e8c07a', '#d4d07a', '#8ec98c', '#5b9e6b']
  const segs = [1,2,3,4,5].map(box => {
    const pct = total > 0 ? ((boxCounts[box] || 0) / total * 100).toFixed(1) : 0
    if (pct == 0) return ''
    return `<div class="box-bar-seg" style="width:${pct}%;background:${colors[box]}" title="Fach ${box}: ${boxCounts[box]||0}"></div>`
  }).join('')
  return `<div class="box-bar">${segs || '<div class="box-bar-seg" style="width:100%;background:#e2d8cf"></div>'}</div>`
}

// ── Study ─────────────────────────────────────────────────────────────────────
function renderStudy() {
  const { deck, queue, queueIdx, flipped } = state
  if (queueIdx >= queue.length) { navigate('summary'); return }

  const raw       = queue[queueIdx]
  const settings  = getDeckSettings(deck.id)
  const card      = settings.reversed
    ? { ...raw, front: raw.back, back: raw.front }
    : raw
  const cardState = getCardState(deck.id, raw.id)

  root.innerHTML = `
    <div class="screen study-screen">
      <header class="study-header">
        <button class="btn btn-ghost back-btn" id="back-home">← Zurück</button>
        <div class="study-deck-name">${escHtml(deck.name)}${settings.reversed ? ' <span class="reversed-badge">⇄</span>' : ''}</div>
        <div class="study-progress-text">${queueIdx + 1} / ${queue.length}</div>
      </header>
      <div class="study-progress-bar">
        <div class="study-progress-fill" style="width:${(queueIdx / queue.length) * 100}%"></div>
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
              <div class="grade-buttons">
                <button class="grade-btn grade-again"  data-grade="0">✗<span>Nochmal</span></button>
                <button class="grade-btn grade-hard"   data-grade="1">~<span>Schwer</span></button>
                <button class="grade-btn grade-good"   data-grade="2">✓<span>Gut</span></button>
                <button class="grade-btn grade-easy"   data-grade="3">★<span>Einfach</span></button>
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
  document.getElementById('reveal-btn')?.addEventListener('click', flipCard)
  document.querySelectorAll('.grade-btn').forEach(btn => {
    btn.addEventListener('click', () => gradeCard(parseInt(btn.dataset.grade)))
  })
}

function flipCard() {
  if (state.flipped) return
  state.flipped = true
  document.getElementById('card-flip')?.classList.add('is-flipped')
  const hint = document.getElementById('study-hint')
  if (hint) hint.textContent = ''
}

function gradeCard(grade) {
  const { deck, queue, queueIdx } = state
  const raw       = queue[queueIdx]
  const cardState = getCardState(deck.id, raw.id)
  const newBox    = nextBox(cardState.box, grade)

  setCardState(deck.id, raw.id, { box: newBox, lastReviewed: today() })
  bumpSessionCount(deck.id, today(), grade)

  state.sessionGrades.push(grade)
  state.queueIdx++
  state.flipped = false
  render()
}

// ── Summary ───────────────────────────────────────────────────────────────────
function renderSummary() {
  const { deck, sessionGrades } = state
  const total    = sessionGrades.length
  const good     = sessionGrades.filter(g => g >= 2).length
  const again    = sessionGrades.filter(g => g === 0).length
  const hard     = sessionGrades.filter(g => g === 1).length
  const easy     = sessionGrades.filter(g => g === 3).length
  const pct      = total > 0 ? Math.round((good / total) * 100) : 0
  const progress = getProgress(deck.id)
  const stats    = getDeckStats(deck, progress)
  const masteredPct = deck.cards.length > 0 ? Math.round((stats.mastered / deck.cards.length) * 100) : 0

  const message = pct >= 90 ? 'Ausgezeichnet! 🎉'
    : pct >= 70 ? 'Sehr gut!'
    : pct >= 50 ? 'Weiter so!'
    : 'Übung macht den Meister.'

  root.innerHTML = `
    <div class="screen summary-screen">
      <div class="summary-card">
        <div class="summary-icon">◈</div>
        <h1 class="summary-title">${message}</h1>
        <div class="summary-stats">
          <div class="stat-item"><div class="stat-num">${total}</div><div class="stat-lbl">Gelernt</div></div>
          <div class="stat-item stat-green"><div class="stat-num">${good}</div><div class="stat-lbl">Gut/Einfach</div></div>
          <div class="stat-item stat-red"><div class="stat-num">${again}</div><div class="stat-lbl">Nochmal</div></div>
        </div>
        <div class="grade-breakdown">
          <div class="grade-row"><span class="grade-dot again"></span>Nochmal<span>${again}</span></div>
          <div class="grade-row"><span class="grade-dot hard"></span>Schwer<span>${hard}</span></div>
          <div class="grade-row"><span class="grade-dot good"></span>Gut<span>${good - easy}</span></div>
          <div class="grade-row"><span class="grade-dot easy"></span>Einfach<span>${easy}</span></div>
        </div>
        <div class="summary-pct">${pct}% gut/einfach</div>
        <div class="summary-bar-wrap">
          <div class="summary-bar"><div class="summary-bar-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="summary-mastered">${masteredPct}% des Decks beherrscht</div>
        <div class="summary-actions">
          <button class="btn btn-study-all" id="btn-again">Alles üben</button>
          <button class="btn btn-primary" id="btn-home">Zur Übersicht</button>
        </div>
      </div>
    </div>
  `
  document.getElementById('btn-home').addEventListener('click', () => navigate('home'))
  document.getElementById('btn-again').addEventListener('click', () => startStudy(deck.id, true))
}

// ── Import ────────────────────────────────────────────────────────────────────
async function handleImport(e) {
  const file = e.target.files[0]
  if (!file) return
  try {
    const data = JSON.parse(await file.text())
    if (!data.name || !Array.isArray(data.cards)) {
      showToast('Ungültiges Format. Brauche "name" und "cards".', 'error'); return
    }
    if (!data.cards.every(c => c.id && c.front && c.back)) {
      showToast('Jede Karte braucht "id", "front", "back".', 'error'); return
    }
    const deck = {
      id: data.id || `deck_${Date.now()}`,
      name: data.name, fach: data.fach ?? null,
      cards: data.cards, importedAt: new Date().toISOString(), folderId: null,
    }
    saveDeck(deck)
    showToast(`"${deck.name}" importiert — ${deck.cards.length} Karten`, 'success')
    render()
  } catch { showToast('Fehler beim Lesen der Datei.', 'error') }
  e.target.value = ''
}

// ── Event delegation ──────────────────────────────────────────────────────────
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]')
  if (!el) return
  const { action, deckId, folderId } = el.dataset

  if (action === 'study')         startStudy(deckId)
  if (action === 'study-all')     startStudy(deckId, true)
  if (action === 'delete')        confirmDelete(deckId)
  if (action === 'reset')         confirmReset(deckId)
  if (action === 'filter-folder') { state.activeFolderId = folderId || null; render() }
  if (action === 'new-folder')    createFolder()
  if (action === 'delete-folder') confirmDeleteFolder(folderId)
})

document.addEventListener('change', e => {
  // Reverse toggle
  if (e.target.classList.contains('reverse-cb')) {
    const deckId   = e.target.dataset.deckId
    const settings = getDeckSettings(deckId)
    settings.reversed = e.target.checked
    saveDeckSettings(deckId, settings)
    showToast(settings.reversed ? 'Vorder/Rückseite getauscht' : 'Normal')
  }
  // Move deck to folder
  if (e.target.dataset.action === 'move-deck') {
    const deckId   = e.target.dataset.deckId
    const decks    = getDecks()
    const deck     = decks[deckId]
    if (deck) { deck.folderId = e.target.value || null; saveDeck(deck) }
  }
})

function startStudy(deckId, all = false) {
  const deck = getDecks()[deckId]
  if (!deck) return
  const progress = getProgress(deckId)
  const queue = all
    ? getAllCardsSorted(deck, progress)
    : getDueCards(deck, progress, getSessionCount(deckId, today()).studied, state.limitOverride)
  if (!queue.length) {
    showToast('Keine Karten im Deck.', 'info')
    return
  }
  navigate('study', { deck, queue, queueIdx: 0, flipped: false, sessionGrades: [], studyAll: all })
}

function confirmReset(deckId) {
  const deck = getDecks()[deckId]
  if (!deck) return
  if (confirm(`Fortschritt von "${deck.name}" zurücksetzen? Alle Karten kommen wieder in Fach 1.`)) {
    resetDeckProgress(deckId)
    showToast('Fortschritt zurückgesetzt — alle Karten in Fach 1', 'info')
    render()
  }
}

function confirmDelete(deckId) {
  const deck = getDecks()[deckId]
  if (!deck) return
  if (confirm(`"${deck.name}" löschen? Fortschritt geht verloren.`)) {
    deleteDeck(deckId); showToast(`"${deck.name}" gelöscht.`); render()
  }
}

function createFolder() {
  const name = prompt('Ordnername:')
  if (!name?.trim()) return
  const colorId = FOLDER_COLORS[getFolders().length % FOLDER_COLORS.length].id
  saveFolder({ id: `f_${Date.now()}`, name: name.trim(), color: colorId })
  render()
}

function confirmDeleteFolder(folderId) {
  const f = getFolders().find(f => f.id === folderId)
  if (!f) return
  if (confirm(`Ordner "${f.name}" löschen? Decks bleiben erhalten.`)) {
    deleteFolder(folderId)
    if (state.activeFolderId === folderId) state.activeFolderId = null
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

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
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

render()
