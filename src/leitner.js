// ── Leitner 5-Box spaced repetition ─────────────────────────────────────────
//
// Box intervals (days between reviews):
//   Box 1 → 1 day   (daily)
//   Box 2 → 2 days
//   Box 3 → 4 days
//   Box 4 → 8 days
//   Box 5 → 16 days  (nearly mastered)

const BOX_INTERVALS = [0, 1, 2, 4, 8, 16]
const MAX_BOX = 5
const DAILY_BUDGET = 20

export function today() {
  return new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD'
}

function daysBetween(dateA, dateB) {
  const a = new Date(dateA)
  const b = new Date(dateB)
  return Math.floor((b - a) / 86400000)
}

// Is this card due today?
export function isDue(cardState) {
  const { box, lastReviewed } = cardState
  if (!lastReviewed) return true                      // never studied → always due
  const interval = BOX_INTERVALS[box] ?? 16
  return daysBetween(lastReviewed, today()) >= interval
}

// After answering: compute new box
export function nextBox(currentBox, correct) {
  if (correct) return Math.min(currentBox + 1, MAX_BOX)
  return 1  // wrong → back to box 1
}

// Get cards due today for a deck, capped at budget minus already studied today
export function getDueCards(deck, progress, studiedToday) {
  const remaining = Math.max(0, DAILY_BUDGET - studiedToday)
  if (remaining === 0) return []

  const allDue = deck.cards.filter(card => {
    const state = progress[card.id] ?? { box: 1, lastReviewed: null }
    return isDue(state)
  })

  // Sort: lower box first (newer/harder cards get priority)
  allDue.sort((a, b) => {
    const boxA = (progress[a.id] ?? { box: 1 }).box
    const boxB = (progress[b.id] ?? { box: 1 }).box
    return boxA - boxB
  })

  return allDue.slice(0, remaining)
}

// Stats for a deck
export function getDeckStats(deck, progress) {
  const total = deck.cards.length
  const boxCounts = [0, 0, 0, 0, 0, 0] // index = box number (0 unused)

  deck.cards.forEach(card => {
    const state = progress[card.id] ?? { box: 1, lastReviewed: null }
    boxCounts[state.box] = (boxCounts[state.box] || 0) + 1
  })

  const mastered = boxCounts[5] || 0
  const dueCount = deck.cards.filter(card => {
    const state = progress[card.id] ?? { box: 1, lastReviewed: null }
    return isDue(state)
  }).length

  return { total, mastered, dueCount, boxCounts }
}
