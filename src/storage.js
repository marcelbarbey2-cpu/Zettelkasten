// ── Storage keys ────────────────────────────────────────────────────────────
const KEY_DECKS    = 'zk_decks'
const KEY_FOLDERS  = 'zk_folders'
const KEY_PROG     = id => `zk_prog_${id}`
const KEY_SESSION  = (id, date) => `zk_sess_${id}_${date}`
const KEY_SETTINGS = id => `zk_settings_${id}` // per-deck: { reversed }

function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)) }

// ── Decks ────────────────────────────────────────────────────────────────────
export function getDecks() { return load(KEY_DECKS, {}) }

export function saveDeck(deck) {
  const all = getDecks()
  all[deck.id] = {
    id: deck.id, name: deck.name, fach: deck.fach ?? null,
    cards: deck.cards, importedAt: deck.importedAt, folderId: deck.folderId ?? null,
  }
  save(KEY_DECKS, all)
}

export function deleteDeck(deckId) {
  const all = getDecks()
  delete all[deckId]
  save(KEY_DECKS, all)
  localStorage.removeItem(KEY_PROG(deckId))
  localStorage.removeItem(KEY_SETTINGS(deckId))
}

// ── Folders ──────────────────────────────────────────────────────────────────
export function getFolders() { return load(KEY_FOLDERS, []) }

export function saveFolder(folder) {
  const all = getFolders()
  const idx = all.findIndex(f => f.id === folder.id)
  if (idx >= 0) all[idx] = folder
  else all.push(folder)
  save(KEY_FOLDERS, all)
}

export function deleteFolder(folderId) {
  const all = getFolders().filter(f => f.id !== folderId)
  save(KEY_FOLDERS, all)
  // Move decks out
  const decks = getDecks()
  Object.values(decks).forEach(d => { if (d.folderId === folderId) d.folderId = null })
  save(KEY_DECKS, decks)
}

// ── Per-deck settings ─────────────────────────────────────────────────────────
export function getDeckSettings(deckId) {
  return load(KEY_SETTINGS(deckId), { reversed: false })
}
export function saveDeckSettings(deckId, settings) {
  save(KEY_SETTINGS(deckId), settings)
}

// ── Progress ─────────────────────────────────────────────────────────────────
export function getProgress(deckId) { return load(KEY_PROG(deckId), {}) }
export function saveProgress(deckId, progress) { save(KEY_PROG(deckId), progress) }

export function getCardState(deckId, cardId) {
  const prog = getProgress(deckId)
  return prog[cardId] ?? { box: 1, lastReviewed: null }
}
export function setCardState(deckId, cardId, state) {
  const prog = getProgress(deckId)
  prog[cardId] = state
  saveProgress(deckId, prog)
}

// ── Daily session ─────────────────────────────────────────────────────────────
export function getSessionCount(deckId, date) {
  return load(KEY_SESSION(deckId, date), { studied: 0, correct: 0 })
}
export function bumpSessionCount(deckId, date, grade) {
  const data = getSessionCount(deckId, date)
  data.studied += 1
  if (grade >= 2) data.correct += 1
  save(KEY_SESSION(deckId, date), data)
}

export function resetDeckProgress(deckId) {
  localStorage.removeItem(KEY_PROG(deckId))
}
