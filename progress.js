// ── Joshua's SAT — shared progress ledger ─────────────────────────
// Storage key: 'joshua_progress'
// Shape: { [questionId]: { correct: number, wrong: number, lastSeen: number } }

const PROGRESS_KEY      = 'joshua_progress';
const MASTERY_THRESHOLD = 2;
const MASTERY_DECAY_MS  = 21 * 86_400_000; // 21 days

function getProgress() {
    try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; }
    catch(e) { return {}; }
}

function _saveProgress(ledger) {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(ledger)); } catch(e) {}
}

// Call after every answered question.
// source: 'practice' | 'exam'  — exam answers count double.
function recordAnswer(id, isCorrect, source) {
    const ledger = getProgress();
    if (!ledger[id]) ledger[id] = { correct: 0, wrong: 0, lastSeen: 0 };
    ledger[id].lastSeen   = Date.now();
    ledger[id].lastSource = source || 'practice';
    if (isCorrect) {
        ledger[id].correct += (source === 'exam') ? 2 : 1;
    } else {
        ledger[id].wrong++;
        if (ledger[id].correct > 0) ledger[id].correct--;
    }
    _saveProgress(ledger);
}

function _isMastered(record) {
    if (!record) return false;
    if (record.lastSeen && Date.now() - record.lastSeen > MASTERY_DECAY_MS) return false;
    return record.correct >= MASTERY_THRESHOLD;
}

// Reorder pool: wrong/struggling first → unseen → mastered last.
function prioritizePool(pool) {
    const ledger   = getProgress();
    const wrong    = [];
    const unseen   = [];
    const mastered = [];

    pool.forEach(q => {
        const r = ledger[q.id];
        if (!r) {
            unseen.push(q);
        } else if (_isMastered(r)) {
            mastered.push(q);
        } else {
            wrong.push(q);
        }
    });

    return [..._fyShuffle(wrong), ..._fyShuffle(unseen), ..._fyShuffle(mastered)];
}

// Returns true when every question in the pool is currently mastered.
function isPoolAllMastered(pool) {
    if (!pool || pool.length === 0) return false;
    const ledger = getProgress();
    return pool.every(q => _isMastered(ledger[q.id]));
}

// Returns { mastered, struggling, unseen, total } counts for a given pool.
function getPoolSummary(pool) {
    const ledger  = getProgress();
    const summary = { mastered: 0, struggling: 0, unseen: 0, total: pool.length };
    pool.forEach(q => {
        const r = ledger[q.id];
        if (!r)               summary.unseen++;
        else if (_isMastered(r)) summary.mastered++;
        else                  summary.struggling++;
    });
    return summary;
}

// Merge an imported ledger into the existing one (take higher correct, sum wrongs).
function mergeProgress(incoming) {
    if (!incoming || typeof incoming !== 'object') return;
    const existing = getProgress();
    Object.entries(incoming).forEach(([id, r]) => {
        if (!existing[id]) {
            existing[id] = r;
        } else {
            existing[id].correct  = Math.max(existing[id].correct  || 0, r.correct  || 0);
            existing[id].wrong    = (existing[id].wrong || 0) + (r.wrong || 0);
            existing[id].lastSeen = Math.max(existing[id].lastSeen || 0, r.lastSeen || 0);
        }
    });
    _saveProgress(existing);
}

function resetLedger() {
    localStorage.removeItem(PROGRESS_KEY);
}

function _fyShuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
