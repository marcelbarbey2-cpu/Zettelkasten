// ── Storage keys ────────────────────────────────────────────────────────────
const KEY_DECKS    = 'zk_decks'          // { [deckId]: DeckMeta }
const KEY_PROG     = id => `zk_prog_${id}` // { [cardId]: { box, lastReviewed } }
const KEY_SESSION  = (id, date) => `zk_sess_${id}_${date}` // { studied, correct }

// ── Helpers ──────────────────────────────────────────────────────────────────
function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

// ── Decks ────────────────────────────────────────────────────────────────────
export function getDecks() {
  return load(KEY_DECKS, {})
}

export function saveDeck(deck) {
  // deck: { id, name, cards: [{id, front, back}], importedAt }
  const all = getDecks()
  all[deck.id] = { id: deck.id, name: deck.name, cards: deck.cards, importedAt: deck.importedAt }
  save(KEY_DECKS, all)
}

export function deleteDeck(deckId) {
  const all = getDecks()
  delete all[deckId]
  save(KEY_DECKS, all)
  localStorage.removeItem(KEY_PROG(deckId))
}

// ── Progress ─────────────────────────────────────────────────────────────────
export function getProgress(deckId) {
  return load(KEY_PROG(deckId), {})
}

export function saveProgress(deckId, progress) {
  save(KEY_PROG(deckId), progress)
}

export function getCardState(deckId, cardId) {
  const prog = getProgress(deckId)
  return prog[cardId] ?? { box: 1, lastReviewed: null }
}

export function setCardState(deckId, cardId, state) {
  const prog = getProgress(deckId)
  prog[cardId] = state
  saveProgress(deckId, prog)
}

// ── Daily session counter ─────────────────────────────────────────────────────
export function getSessionCount(deckId, date) {
  const data = load(KEY_SESSION(deckId, date), { studied: 0, correct: 0 })
  return data
}

export function bumpSessionCount(deckId, date, correct) {
  const data = getSessionCount(deckId, date)
  data.studied += 1
  if (correct) data.correct += 1
  save(KEY_SESSION(deckId, date), data)
}

export function resetDeckProgress(deckId) {
  localStorage.removeItem(KEY_PROG(deckId))
}
