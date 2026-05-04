// ── Leitner 5-Box + Anki-style grading ───────────────────────────────────────
//
// Box intervals (days between reviews):
//   Box 1 → 1 day   (daily)
//   Box 2 → 2 days
//   Box 3 → 4 days
//   Box 4 → 8 days
//   Box 5 → 16 days
//
// Anki-style grades:
//   0 = Again  → box 1
//   1 = Hard   → stay (same box)
//   2 = Good   → box + 1
//   3 = Easy   → box + 2

const BOX_INTERVALS = [0, 1, 2, 4, 8, 16]
const MAX_BOX = 5
export const DAILY_BUDGET = 20

export function today() {
  return new Date().toISOString().slice(0, 10)
}

function daysBetween(dateA, dateB) {
  const a = new Date(dateA)
  const b = new Date(dateB)
  return Math.floor((b - a) / 86400000)
}

export function isDue(cardState) {
  const { box, lastReviewed } = cardState
  if (!lastReviewed) return true
  const interval = BOX_INTERVALS[box] ?? 16
  return daysBetween(lastReviewed, today()) >= interval
}

// grade: 0=Again, 1=Hard, 2=Good, 3=Easy
export function nextBox(currentBox, grade) {
  if (grade === 0) return 1
  if (grade === 1) return currentBox                        // stay
  if (grade === 2) return Math.min(currentBox + 1, MAX_BOX)
  if (grade === 3) return Math.min(currentBox + 2, MAX_BOX)
  return 1
}

export function getDueCards(deck, progress, studiedToday, limitOverride = false) {
  const remaining = limitOverride ? Infinity : Math.max(0, DAILY_BUDGET - studiedToday)
  if (remaining === 0) return []

  const allDue = deck.cards.filter(card => {
    const state = progress[card.id] ?? { box: 1, lastReviewed: null }
    return isDue(state)
  })

  allDue.sort((a, b) => {
    const boxA = (progress[a.id] ?? { box: 1 }).box
    const boxB = (progress[b.id] ?? { box: 1 }).box
    return boxA - boxB
  })

  return limitOverride ? allDue : allDue.slice(0, remaining)
}

export function getAllCardsSorted(deck, progress) {
  return [...deck.cards].sort((a, b) => {
    const boxA = (progress[a.id] ?? { box: 1 }).box
    const boxB = (progress[b.id] ?? { box: 1 }).box
    return boxA - boxB
  })
}

export function getDeckStats(deck, progress) {
  const total = deck.cards.length
  const boxCounts = [0, 0, 0, 0, 0, 0]

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
