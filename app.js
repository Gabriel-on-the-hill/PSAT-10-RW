// ── Combine all domain banks ───────────────────────────────────────
const questionBank = [
    ...(typeof questionBank_CS  !== 'undefined' ? questionBank_CS  : []),
    ...(typeof questionBank_EOI !== 'undefined' ? questionBank_EOI : []),
    ...(typeof questionBank_II  !== 'undefined' ? questionBank_II  : []),
    ...(typeof questionBank_CON !== 'undefined' ? questionBank_CON : []),
];

// ── Skill metadata ─────────────────────────────────────────────────
const SKILL_ABBR = {
    'Words in Context':                   'WIC',
    'Text Structure and Purpose':         'TSP',
    'Cross-Text Connections':             'CTC',
    'Rhetorical Synthesis':               'RS',
    'Transitions':                        'Trans',
    'Central Ideas and Details':          'CID',
    'Command of Evidence — Textual':      'CoE-T',
    'Command of Evidence — Quantitative': 'CoE-Q',
    'Inferences':                         'Inf',
    'Boundaries':                         'Bdry',
    'Form, Structure, and Sense':         'FSS',
};

const SKILL_DOMAIN = {
    'Words in Context':                   'Craft & Structure',
    'Text Structure and Purpose':         'Craft & Structure',
    'Cross-Text Connections':             'Craft & Structure',
    'Rhetorical Synthesis':               'Expression of Ideas',
    'Transitions':                        'Expression of Ideas',
    'Central Ideas and Details':          'Information & Ideas',
    'Command of Evidence — Textual':      'Information & Ideas',
    'Command of Evidence — Quantitative': 'Information & Ideas',
    'Inferences':                         'Information & Ideas',
    'Boundaries':                         'Conventions',
    'Form, Structure, and Sense':         'Conventions',
};

const TRAP_SETS = {
    'Words in Context':
        'Familiar Definition · Fancy Synonym · Connotation Mismatch',
    'Text Structure and Purpose':
        'Topic Match Function Miss · Part-for-Whole · Intensity Mismatch',
    'Cross-Text Connections':
        'One-Sided Focus · Qualification as Disagreement · Shared Topic = Agreement',
    'Rhetorical Synthesis':
        'Wrong Goal · Accurate But Off-Task · Over-Inclusive',
    'Transitions':
        'Wrong Direction · Formal Without Logic · Sequence vs. Contrast',
    'Central Ideas and Details':
        'Too Specific · Opposite Direction · Outside Knowledge',
    'Command of Evidence — Textual':
        'Adjacent Evidence · Related but Not Specific · Direction Error',
    'Command of Evidence — Quantitative':
        'Wrong Variable · Overgeneralization · Direction Error',
    'Inferences':
        'Too Extreme · Possible but Unsupported · Outside Knowledge',
    'Boundaries':
        'Comma Splice · Fragment · Unnecessary Comma',
    'Form, Structure, and Sense':
        'Proximity Trap · Intervening Phrase · Tense Contamination',
};

// Skill-count element IDs
const SKILL_COUNT_IDS = {
    'Central Ideas and Details':          'count-cid',
    'Command of Evidence — Textual':      'count-coe-t',
    'Command of Evidence — Quantitative': 'count-coe-q',
    'Inferences':                         'count-inf',
    'Words in Context':                   'count-wic',
    'Text Structure and Purpose':         'count-tsp',
    'Cross-Text Connections':             'count-ctc',
    'Rhetorical Synthesis':               'count-rs',
    'Transitions':                        'count-trans',
    'Boundaries':                         'count-bdry',
    'Form, Structure, and Sense':         'count-fss',
};

const STORAGE = {
    HISTORY: 'psat10_history',
    SESSION: 'psat10_session',
    SPLIT:   'psat10_split',
};

const EXAM_DATE = new Date('2026-10-15'); // PSAT/NMSQT — confirm exact date with College Board

// ── State ──────────────────────────────────────────────────────────
let currentQuestionIndex = 0;
let score            = 0;
let userMode         = 'assisted';
let timerInterval    = null;
let secondsElapsed   = 0;
let isAnswered       = false;
let activeQuestions  = [];
let missedQuestions  = [];
let sessionResults   = [];
let reviewMode       = false;
let questionStartTime = 0;

// ══════════════════════════════════════════════════════════════════
// SETUP SCREEN
// ══════════════════════════════════════════════════════════════════

function getSelectedSkills() {
    return Array.from(document.querySelectorAll('input[name="skill"]:checked'))
        .map(el => el.value);
}

function getSelectedDiffs() {
    return Array.from(document.querySelectorAll('input[name="diff"]:checked'))
        .map(el => el.value);
}

function getLimit() {
    return parseInt(document.getElementById('limitSelect').value);
}

function buildActiveQuestions() {
    const skills = getSelectedSkills();
    const diffs  = getSelectedDiffs();
    const limit  = getLimit();

    let filtered = questionBank.filter(
        q => skills.includes(q.skill) && diffs.includes(q.difficulty)
    );

    // Fisher-Yates shuffle
    for (let i = filtered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
    }

    return limit > 0 ? filtered.slice(0, limit) : filtered;
}

function updateSetupUI() {
    const diffs = getSelectedDiffs();

    Object.entries(SKILL_COUNT_IDS).forEach(([skill, id]) => {
        const el = document.getElementById(id);
        if (!el) return;
        const n = questionBank.filter(
            q => q.skill === skill && diffs.includes(q.difficulty)
        ).length;
        el.textContent = n > 0 ? n + ' q' : '—';
    });

    const total   = buildActiveQuestions().length;
    const summary = document.getElementById('sessionSummary');
    const startBtn= document.getElementById('startSessionBtn');

    if (total === 0) {
        summary.textContent = 'No questions match — adjust selections.';
        summary.className   = 'session-summary session-summary-empty';
        startBtn.disabled   = true;
    } else {
        const labels = getSelectedSkills().map(s => SKILL_ABBR[s] || s);
        summary.textContent = `${total} question${total !== 1 ? 's' : ''} — ${labels.join(' + ')} — ${diffs.join(' · ')}`;
        summary.className   = 'session-summary';
        startBtn.disabled   = false;
    }
}

function applyPreset(btn) {
    const skills = btn.dataset.skills.split(',').map(s => s.trim());
    const diffs  = btn.dataset.diffs.split(',').map(d => d.trim());

    document.querySelectorAll('input[name="skill"]').forEach(el => {
        el.checked = skills.includes(el.value);
    });
    document.querySelectorAll('input[name="diff"]').forEach(el => {
        el.checked = diffs.includes(el.value);
    });
    document.getElementById('limitSelect').value = btn.dataset.limit;
    updateSetupUI();
}

function showSetup() {
    stopTimer();
    document.getElementById('timerDisplay').classList.add('hidden');
    document.getElementById('setupScreen').style.display  = 'flex';
    document.getElementById('app').style.display          = 'none';
    document.getElementById('completionScreen').style.display = 'none';
    updateSetupUI();
    renderHistory();
    checkForSavedSession();
    updateExamCountdown();
    renderLifetimeStats();
}

function hideSetup() {
    document.getElementById('setupScreen').style.display = 'none';
    document.getElementById('app').style.display         = 'flex';
}

// ══════════════════════════════════════════════════════════════════
// PASSAGE FORMATTING  — handles all 11 skill nuances
// ══════════════════════════════════════════════════════════════════

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* Detect if passage looks like a table (multiple tab/space-separated numeric rows) */
function looksLikeTable(text) {
    const lines = text.split('\n').filter(l => l.trim());
    const numericRows = lines.filter(l => /\d/.test(l) && l.trim().split(/\s{2,}|\t/).length >= 2);
    return numericRows.length >= 2;
}

/* Try to render a raw text table as an HTML table */
function renderTable(text) {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return `<pre>${escapeHtml(text)}</pre>`;

    // Split each line on 2+ spaces or tabs
    const rows = lines.map(l => l.trim().split(/\s{2,}|\t/));
    const header = rows[0];
    const body   = rows.slice(1);

    const thCells = header.map(h => `<th>${escapeHtml(h)}</th>`).join('');
    const tRows   = body.map(row => {
        const tds = row.map(c => `<td>${escapeHtml(c)}</td>`).join('');
        return `<tr>${tds}</tr>`;
    }).join('');

    return `<table class="data-table"><thead><tr>${thCells}</tr></thead><tbody>${tRows}</tbody></table>`;
}

function formatPassage(passage, skill, question) {
    if (!passage) {
        // Conventions questions embed the stem — show placeholder
        return '';
    }

    // Fix ligature artifacts
    let text = passage
        .replace(/\ufb01/g, 'fi').replace(/\ufb02/g, 'fl');

    // ── Command of Evidence — Quantitative: smart data display ────
    if (skill === 'Command of Evidence — Quantitative') {
        return formatCoEQ(text);
    }

    // ── Cross-Text Connections: render Text 1 / Text 2 headers ────
    if (skill === 'Cross-Text Connections') {
        const parts = text.split(/\n?\s*(Text [12])\s*\n/i);
        // parts may be: ['', 'Text 1', '...body...', 'Text 2', '...body...']
        if (parts.length >= 3) {
            let html = '';
            for (let i = 0; i < parts.length; i++) {
                if (/^Text [12]$/i.test(parts[i].trim())) {
                    html += `<span class="cross-text-label">${escapeHtml(parts[i].trim())}</span>`;
                } else if (parts[i].trim()) {
                    html += escapeHtml(parts[i].trim());
                }
            }
            return html;
        }
        // Fallback: look for "Text 1" / "Text 2" inline
        let html = escapeHtml(text);
        html = html.replace(/(Text [12])\s*/gi, '<span class="cross-text-label">$1</span>');
        return html;
    }

    // ── Rhetorical Synthesis: bullet list of notes ─────────────────
    if (skill === 'Rhetorical Synthesis') {
        const colonIdx = text.indexOf(':');
        if (colonIdx !== -1) {
            const intro    = escapeHtml(text.substring(0, colonIdx + 1));
            const notesRaw = text.substring(colonIdx + 1).trim();
            // Split on sentence boundaries (period followed by capital or bullet)
            const notes = notesRaw
                .split(/(?<=\.)\s+(?=[A-Z\u201c\u2018"])/g)
                .map(n => n.trim()).filter(n => n);
            const items = notes.map(n => `<li>${escapeHtml(n)}</li>`).join('');
            return `<p class="rs-intro">${intro}</p><ul class="rs-notes">${items}</ul>`;
        }
    }

    // CoE-Q is handled above via formatCoEQ(); fall through for other skills

    // ── Transitions / Boundaries / FSS: highlight blank ───────────
    if (['Transitions', 'Boundaries', 'Form, Structure, and Sense'].includes(skill)) {
        let html = escapeHtml(text);
        html = html.replace(/_{3,}/g, '<span class="q-blank">______</span>');
        return html;
    }

    // ── Default: plain escaped text ────────────────────────────────
    return escapeHtml(text);
}

// ── CoE-Q smart renderer ───────────────────────────────────────────
function formatCoEQ(text) {
    const lines = text.split('\n');

    // Split passage into data portion and narrative portion.
    // Narrative: a long sentence (>65 chars, multiple words, contains punctuation like comma/period)
    // that starts AFTER at least 3 lines of data.
    let narrativeIdx = lines.length;
    for (let i = 2; i < lines.length; i++) {
        const l = lines[i].trim();
        if (l.length > 65 && l.split(' ').length > 10 && /[,.]/.test(l) && /[a-z]/.test(l[1])) {
            narrativeIdx = i;
            break;
        }
    }

    const dataLines = lines.slice(0, narrativeIdx).map(l => l.trim()).filter(l => l);
    const narrative = lines.slice(narrativeIdx).join(' ').trim();

    // Determine if the data block is a structured table or a graph/chart.
    // Graph signal: many lines that are purely numbers (y-axis values)
    const pureNumericLines = dataLines.filter(l => /^[\d.,\s%\-–]+$/.test(l));
    const isGraph = pureNumericLines.length >= 4 &&
                    pureNumericLines.length > dataLines.length * 0.35;

    let dataHtml;
    if (isGraph) {
        // Render as styled pre — can't reconstruct a bar/line chart meaningfully
        dataHtml = `
        <div class="data-block">
            <div class="data-block-label">&#128200; Chart / Graph Data</div>
            <pre class="data-pre">${escapeHtml(dataLines.join('\n'))}</pre>
        </div>`;
    } else {
        // Attempt structured HTML table
        dataHtml = tryBuildHTMLTable(dataLines);
    }

    const narrativeHtml = narrative
        ? `<p class="data-narrative">${escapeHtml(narrative)}</p>`
        : '';

    return dataHtml + narrativeHtml;
}

function tryBuildHTMLTable(dataLines) {
    if (dataLines.length < 3) {
        return `<div class="data-block"><pre class="data-pre">${escapeHtml(dataLines.join('\n'))}</pre></div>`;
    }

    // Title: first 1–2 lines that are long descriptive text (not numbers)
    let titleEnd = 0;
    for (let i = 0; i < Math.min(3, dataLines.length); i++) {
        const l = dataLines[i];
        if (!/^\d/.test(l) && l.length > 5) titleEnd = i + 1;
        else break;
    }
    const titleText = dataLines.slice(0, titleEnd).join(' ');
    const bodyLines = dataLines.slice(titleEnd);

    // Detect N-column pattern: look for a line with multiple space-separated values
    // that is likely a combined header row, e.g. "1995 2020" or "Height (meters) Age"
    let numCols = 2; // default 2-column table
    let headerLines = [];
    let dataStart = 0;

    // Row-label header (e.g. "Season", "Country", "Tribal nation")
    // is usually the first body line (short text, no numbers)
    // Then column headers follow
    // Then alternating: label, value, value, ...

    // Simple heuristic: try groups of 2, 3, 4 and pick best fit
    for (let n = 2; n <= 4; n++) {
        const candidateRows = [];
        let ok = true;
        let i = 0;
        // Skip header lines (non-numeric text before first numeric value)
        while (i < bodyLines.length && !/[\d%]/.test(bodyLines[i])) i++;
        const firstDataIdx = i;
        // Try to group remaining lines in (n-1) value groups after each label
        i = firstDataIdx;
        while (i < bodyLines.length) {
            const label = bodyLines[i]; i++;
            const vals = [];
            for (let v = 0; v < n - 1 && i < bodyLines.length; v++, i++) {
                vals.push(bodyLines[i]);
            }
            if (vals.length === n - 1) candidateRows.push([label, ...vals]);
            else { ok = false; break; }
        }
        if (ok && candidateRows.length >= 2) {
            // Build table
            const headers = bodyLines.slice(0, firstDataIdx);
            const colHeaders = headers.length > 0 ? headers : ['Value'];
            const thCells = `<th>${escapeHtml(colHeaders[0] || '')}</th>` +
                colHeaders.slice(1).map(h => `<th>${escapeHtml(h)}</th>`).join('') +
                (colHeaders.length < n
                    ? Array(n - colHeaders.length).fill('<th></th>').join('')
                    : '');
            const tRows = candidateRows.map(row =>
                `<tr>${row.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`
            ).join('');
            return `
            <div class="data-block">
                <div class="data-block-label">&#128202; ${escapeHtml(titleText)}</div>
                <table class="data-table-html">
                    <thead><tr>${thCells}</tr></thead>
                    <tbody>${tRows}</tbody>
                </table>
            </div>`;
        }
    }

    // Fallback: styled pre
    return `
    <div class="data-block">
        <div class="data-block-label">&#128202; ${escapeHtml(titleText)}</div>
        <pre class="data-pre">${escapeHtml(dataLines.slice(titleEnd > 0 ? titleEnd : 0).join('\n'))}</pre>
    </div>`;
}

// ══════════════════════════════════════════════════════════════════
// QUESTION DISPLAY
// ══════════════════════════════════════════════════════════════════

function loadQuestion(index) {
    isAnswered = false;
    questionStartTime = Date.now();
    const q    = activeQuestions[index];

    const feedbackEl  = document.getElementById('feedbackContainer');
    const optionsEl   = document.getElementById('optionsContainer');
    const predStepEl  = document.getElementById('predictionStep');

    feedbackEl.className = 'feedback-section';
    optionsEl.innerHTML  = '';
    optionsEl.classList.add('hidden');
    predStepEl.classList.add('hidden');

    // ── Skill + domain badges ──────────────────────────────────────
    document.getElementById('skillBadge').textContent  = SKILL_ABBR[q.skill] || q.skill;
    document.getElementById('domainBadge').textContent = SKILL_DOMAIN[q.skill] || '';

    // ── Difficulty badge ───────────────────────────────────────────
    const diffBadge = document.getElementById('difficultyBadge');
    diffBadge.textContent = q.difficulty;
    diffBadge.className   = 'badge ' + (
        q.difficulty === 'Easy'   ? 'badge-green' :
        q.difficulty === 'Hard'   ? 'badge-red'   : 'badge-orange'
    );

    // ── Counter / review label ─────────────────────────────────────
    document.getElementById('questionCounter').textContent =
        `Q ${index + 1} / ${activeQuestions.length}`;
    const reviewLabel = document.getElementById('reviewLabel');
    if (reviewLabel) reviewLabel.style.display = reviewMode ? 'inline-block' : 'none';

    // ── Passage ────────────────────────────────────────────────────
    const passageEl = document.getElementById('passageContent');
    const passageHtml = formatPassage(q.passage, q.skill, q.question);

    if (!passageHtml) {
        // Conventions / no-passage questions: show a muted note
        passageEl.innerHTML = '<em style="color:var(--text-muted);font-size:0.9rem;">Sentence is embedded in the question →</em>';
    } else {
        passageEl.innerHTML = passageHtml;
    }

    // ── Question text ──────────────────────────────────────────────
    const questionEl = document.getElementById('questionText');

    if (q.skill === 'Rhetorical Synthesis' && userMode === 'assisted') {
        // Highlight the writing goal
        const escaped = escapeHtml(q.question);
        const highlighted = escaped.replace(
            /(wants to\s+)(.+?)(\.\s+Which choice)/i,
            '$1<span class="rs-goal">$2</span>$3'
        );
        questionEl.innerHTML = highlighted;
    } else {
        questionEl.textContent = q.question;
    }

    // ── Assisted mode: strategy hints ─────────────────────────────
    if (userMode === 'assisted') {
        buildStrategyHint(q);
        predStepEl.classList.remove('hidden');
        applyPassageHighlights(q);
    } else {
        optionsEl.classList.remove('hidden');
    }

    // ── Build option buttons ───────────────────────────────────────
    q.options.forEach(opt => {
        const btn  = document.createElement('button');
        btn.className = 'option-btn';

        // Split "A. text" into letter + body for visual formatting
        const letterMatch = opt.match(/^([A-D])\.\s*/);
        if (letterMatch) {
            const letter = letterMatch[1];
            const body   = opt.slice(letterMatch[0].length);
            btn.innerHTML =
                `<span class="opt-letter">${escapeHtml(letter)}.</span>` +
                `<span>${escapeHtml(body)}</span>`;
        } else {
            btn.innerHTML = `<span>${escapeHtml(opt)}</span>`;
        }

        const letter = opt.trim()[0];
        btn.addEventListener('click', () => handleOptionClick(btn, letter, q));
        optionsEl.appendChild(btn);
    });
}

// ── Build strategy hint per skill ─────────────────────────────────
function buildStrategyHint(q) {
    const el = document.getElementById('predictionHint');

    const hints = {
        'Words in Context': `
            <strong>&#128161; Two-Filter Method</strong><br>
            Predict the meaning from context — then apply both filters:<br>
            <strong>Filter 1:</strong> Logical sense in this sentence?&nbsp;&nbsp;
            <strong>Filter 2:</strong> Right <em>tone and intensity</em>?<br>
            <em>Cover the choices. Read the sentence around the word first.</em>`,

        'Text Structure and Purpose': `
            <strong>&#128161; Function Map</strong><br>
            Ask: what is the author <em>doing</em> — not what it's about.<br>
            <em>Argues · Describes · Explains · Compares · Challenges · Supports · Narrates</em><br>
            Circle signal words before looking at choices.`,

        'Cross-Text Connections': `
            <strong>&#128161; Perspective Synthesis</strong><br>
            Summarise Text 1 in one sentence. Then Text 2. Then name the relationship:<br>
            <em>Agreement · Disagreement · Extension · Qualification · Exemplification</em><br>
            <strong>Key trap:</strong> Qualification ≠ Disagreement. Look for "while," "although," "only when."`,

        'Rhetorical Synthesis': `
            <strong>&#128161; Goal-First Filter</strong><br>
            Read the <em>writing goal</em> (highlighted above) before the notes.<br>
            Every answer must accomplish that exact goal — not just be accurate.<br>
            Cross out answers that accomplish the <em>wrong</em> goal.`,

        'Transitions': `
            <strong>&#128161; Direction Check</strong><br>
            Identify the logical relationship <em>before</em> looking at options:<br>
            <em>Contrast · Addition · Cause-Effect · Example · Sequence</em><br>
            Wrong direction = wrong answer, even if the word sounds formal.`,

        'Central Ideas and Details': `
            <strong>&#128161; Locate-and-Verify</strong><br>
            Find the specific sentence in the passage that answers the question.<br>
            The correct answer must be <em>directly supported</em> — not just related.<br>
            If you can't point to the exact lines, keep looking.`,

        'Command of Evidence — Textual': `
            <strong>&#128161; Anchor Before Answer</strong><br>
            Find the specific sentence that supports or illustrates the claim.<br>
            The evidence must do the <em>exact job</em> described — not just be topically related.<br>
            <em>Dense passages:</em> underline the claim first, then hunt for the match.`,

        'Command of Evidence — Quantitative': `
            <strong>&#128161; Read-the-Axis First</strong><br>
            Before answering: (1) read the table/graph title, (2) read axis or column labels, (3) note units.<br>
            Then find the exact data point that supports the specific claim.<br>
            <strong>Trap:</strong> Real data from the wrong column or year.`,

        'Inferences': `
            <strong>&#128161; Conservative Choice</strong><br>
            The correct inference is always the <em>smallest</em> claim fully supported by the passage.<br>
            Ask: "Does the passage actually <em>say or strongly imply</em> this?"<br>
            If you're adding your own reasoning — that's the wrong answer.`,

        'Boundaries': `
            <strong>&#128161; Bracket-the-Clauses</strong><br>
            Read the sentence and bracket each subject-verb pair.<br>
            Two independent clauses → Period, Semicolon, or Comma + FANBOYS.<br>
            <strong>Never</strong> a comma alone between two independent clauses.`,

        'Form, Structure, and Sense': `
            <strong>&#128161; Subject Hunt</strong><br>
            Strip all prepositional phrases and relative clauses to find the <em>real subject</em>.<br>
            Then match: subject-verb agreement, tense, pronoun antecedent, parallel structure.<br>
            The correct answer is always the cleanest, most direct form.`,
    };

    el.innerHTML = hints[q.skill] || '&#128161; Predict your answer before revealing the choices.';
}

// ── Post-render passage highlights ────────────────────────────────
function applyPassageHighlights(q) {
    if (q.skill !== 'Words in Context') return;

    // Extract target word from question: "what does the word 'X'" or "As used … 'X'"
    const passageEl = document.getElementById('passageContent');
    const wordMatch = q.question.match(/["\u201c]([^"\u201d]+)["\u201d]/);
    if (!wordMatch) return;

    const word  = wordMatch[1].trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(\\b${word}\\b)`, 'gi');
    passageEl.innerHTML = passageEl.innerHTML.replace(
        regex,
        '<span class="wic-highlight">$1</span>'
    );
}

// ══════════════════════════════════════════════════════════════════
// ANSWER HANDLING
// ══════════════════════════════════════════════════════════════════

function handleOptionClick(btn, selectedLetter, q) {
    if (isAnswered) return;
    isAnswered = true;

    const isCorrect  = selectedLetter === q.answer;
    const feedbackEl = document.getElementById('feedbackContainer');
    const feedbackTitle = document.getElementById('feedbackTitle');
    const optionsEl  = document.getElementById('optionsContainer');

    const secsOnQuestion = Math.round((Date.now() - questionStartTime) / 1000);
    sessionResults.push({ q, selected: selectedLetter, correct: q.answer, isCorrect, secs: secsOnQuestion });
    if (!isCorrect) missedQuestions.push({ q, selected: selectedLetter });

    if (isCorrect) {
        btn.classList.add('correct');
        score++;
        document.getElementById('currentScore').textContent = score;
        feedbackTitle.textContent   = 'Correct!';
        feedbackEl.className = 'feedback-section visible feedback-success';
    } else {
        btn.classList.add('incorrect');
        // Reveal correct answer
        Array.from(optionsEl.children).forEach(b => {
            if (b.innerText.trim()[0] === q.answer) b.classList.add('correct');
        });
        feedbackTitle.textContent = 'Not quite.';
        feedbackEl.className = 'feedback-section visible feedback-error';
    }

    // Show explanation (strip "Strategy: X\n" prefix for cleaner display)
    const rawExplanation = q.explanation || '';
    const explanationBody = rawExplanation.replace(/^Strategy:[^\n]+\n/, '').trim();
    document.getElementById('feedbackText').innerText   = explanationBody;
    document.getElementById('strategyName').textContent = q.strategy || 'POE';
    document.getElementById('trapName').textContent     = TRAP_SETS[q.skill] || q.trapName || '—';

    saveSessionState();
}

// ══════════════════════════════════════════════════════════════════
// COMPLETION SCREEN
// ══════════════════════════════════════════════════════════════════

function showCompletion() {
    const total = activeQuestions.length;
    const pct   = Math.round((score / total) * 100);

    document.getElementById('completionBigScore').textContent = `${score} / ${total}`;
    const pctEl = document.getElementById('completionPct');
    pctEl.textContent = `${pct}%`;
    pctEl.className   = 'completion-pct ' + (pct >= 80 ? 'pct-pass' : pct >= 60 ? 'pct-warn' : 'pct-fail');

    // Time summary (Standard + Exam modes only)
    const timeEl = document.getElementById('completionTime');
    if (timeEl) {
        if (secondsElapsed > 0) {
            const m   = Math.floor(secondsElapsed / 60);
            const s   = secondsElapsed % 60;
            const avg = Math.round(secondsElapsed / total);
            timeEl.textContent = `${m}m ${s}s total · avg ${avg}s / question`;
            timeEl.style.display = 'block';
        } else {
            timeEl.style.display = 'none';
        }
    }

    // Per-skill breakdown
    const stats = {};
    sessionResults.forEach(r => {
        if (!stats[r.q.skill]) stats[r.q.skill] = { correct: 0, total: 0 };
        stats[r.q.skill].total++;
        if (r.isCorrect) stats[r.q.skill].correct++;
    });

    document.getElementById('skillBreakdown').innerHTML =
        Object.entries(stats).map(([skill, s]) => {
            const p   = Math.round(s.correct / s.total * 100);
            const cls = p >= 80 ? 'bd-pass' : p >= 60 ? 'bd-warn' : 'bd-fail';
            const bar = Math.round(p / 5);
            return `
            <div class="breakdown-row">
                <span class="breakdown-skill">${SKILL_ABBR[skill] || skill}</span>
                <span class="breakdown-bar">${'█'.repeat(bar)}${'░'.repeat(20 - bar)}</span>
                <span class="breakdown-score ${cls}">${s.correct}/${s.total} (${p}%)</span>
            </div>`;
        }).join('');

    // Missed questions
    const missedListEl  = document.getElementById('missedList');
    const reviewBtn     = document.getElementById('reviewMissedBtn');
    const missedHeading = document.getElementById('missedHeading');

    if (missedQuestions.length === 0) {
        missedHeading.textContent = 'All correct — no misses this session';
        missedListEl.innerHTML    = '';
        reviewBtn.style.display   = 'none';
    } else {
        missedHeading.textContent = `Missed (${missedQuestions.length})`;
        document.getElementById('missedCount').textContent = missedQuestions.length;
        reviewBtn.style.display = 'flex';

        missedListEl.innerHTML = missedQuestions.map(({ q, selected }) => {
            const shortQ   = q.question.length > 120
                ? q.question.slice(0, 120) + '\u2026' : q.question;
            const wrongOpt = q.options.find(o => o.trim().startsWith(selected + '.')) || '';
            const rightOpt = q.options.find(o => o.trim().startsWith(q.answer  + '.')) || '';
            const wrongText = wrongOpt.replace(/^[A-D]\.\s*/, '').trim();
            const rightText = rightOpt.replace(/^[A-D]\.\s*/, '').trim();
            const diffCls  = q.difficulty === 'Easy' ? 'badge-green'
                           : q.difficulty === 'Hard' ? 'badge-red' : 'badge-orange';
            return `
            <div class="missed-item">
                <div class="missed-meta">
                    <span class="badge ${diffCls}" style="font-size:0.62rem;margin-bottom:0">${q.difficulty}</span>
                    <span class="missed-skill">${SKILL_ABBR[q.skill] || q.skill}</span>
                </div>
                <div class="missed-q">${escapeHtml(shortQ)}</div>
                <div class="missed-answers">
                    <span class="missed-wrong">\u2717 ${escapeHtml(wrongText)}</span>
                    <span class="missed-right">\u2713 ${escapeHtml(rightText)}</span>
                </div>
            </div>`;
        }).join('');
    }

    document.getElementById('completionScreen').style.display = 'flex';
    document.getElementById('app').style.display              = 'none';
}

function startReviewMissed() {
    const toReview  = missedQuestions.map(m => m.q);
    reviewMode      = true;
    activeQuestions = toReview;
    missedQuestions = [];
    sessionResults  = [];
    document.getElementById('completionScreen').style.display = 'none';
    resetProgress();
    hideSetup();
    document.getElementById('app').style.display = 'flex';
    loadQuestion(0);
}

// ══════════════════════════════════════════════════════════════════
// PROGRESS / TIMER
// ══════════════════════════════════════════════════════════════════

function resetProgress() {
    currentQuestionIndex = 0;
    score                = 0;
    secondsElapsed       = 0;
    if (!reviewMode) { missedQuestions = []; sessionResults = []; }
    document.getElementById('currentScore').textContent    = '0';
    document.getElementById('questionCounter').textContent =
        `Q 1 / ${activeQuestions.length}`;
    updateTimerDisplay();
}

function startTimer() {
    stopTimer();
    timerInterval = setInterval(() => { secondsElapsed++; updateTimerDisplay(); }, 1000);
}

function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateTimerDisplay() {
    const m = Math.floor(secondsElapsed / 60);
    const s = secondsElapsed % 60;
    document.getElementById('timerDisplay').textContent =
        `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ══════════════════════════════════════════════════════════════════
// SESSION STATE  (resume on refresh)
// ══════════════════════════════════════════════════════════════════

function saveSessionState() {
    const state = {
        questionIds:    activeQuestions.map(q => q.id),
        index:          currentQuestionIndex,
        score,
        mode:           userMode,
        missedIds:      missedQuestions.map(m => m.q.id),
        secondsElapsed,
        savedAt:        Date.now(),
    };
    try { localStorage.setItem(STORAGE.SESSION, JSON.stringify(state)); } catch(e) {}
}

function loadSessionState() {
    try {
        const raw = localStorage.getItem(STORAGE.SESSION);
        if (!raw) return null;
        const state = JSON.parse(raw);
        if (Date.now() - state.savedAt > 86_400_000) { clearSessionState(); return null; }
        return state;
    } catch(e) { return null; }
}

function clearSessionState() { localStorage.removeItem(STORAGE.SESSION); }

function restoreSession(state) {
    const idMap     = Object.fromEntries(questionBank.map(q => [q.id, q]));
    activeQuestions = state.questionIds.map(id => idMap[id]).filter(Boolean);
    if (activeQuestions.length === 0) { clearSessionState(); return false; }

    currentQuestionIndex = Math.min(state.index, activeQuestions.length - 1);
    score               = state.score         || 0;
    secondsElapsed      = state.secondsElapsed || 0;
    userMode            = state.mode          || 'assisted';
    missedQuestions     = (state.missedIds || [])
        .map(id => idMap[id]).filter(Boolean).map(q => ({ q }));
    return true;
}

function checkForSavedSession() {
    const banner = document.getElementById('resumeBanner');
    if (!banner) return;
    const state = loadSessionState();
    if (!state) { banner.style.display = 'none'; return; }

    const idMap   = Object.fromEntries(questionBank.map(q => [q.id, q]));
    const valid   = state.questionIds.filter(id => idMap[id]).length;
    if (valid === 0) { clearSessionState(); banner.style.display = 'none'; return; }

    const answered  = state.index;
    const remaining = valid - answered;
    document.getElementById('resumeInfo').textContent =
        `Saved session — Q${answered + 1}/${valid} · ${state.score} correct · ${remaining} remaining`;
    banner.style.display = 'flex';
}

// ══════════════════════════════════════════════════════════════════
// SESSION HISTORY
// ══════════════════════════════════════════════════════════════════

function logSession(skills, diffs, sessionScore, total) {
    // Build per-skill breakdown from sessionResults
    const skillStats = {};
    sessionResults.forEach(r => {
        if (!skillStats[r.q.skill]) skillStats[r.q.skill] = { correct: 0, total: 0 };
        skillStats[r.q.skill].total++;
        if (r.isCorrect) skillStats[r.q.skill].correct++;
    });

    const totalSecs = secondsElapsed;
    const avgSecs   = totalSecs > 0 ? Math.round(totalSecs / total) : null;

    const record = {
        date: new Date().toISOString(),
        skills, diffs,
        score: sessionScore, total,
        pct:   Math.round((sessionScore / total) * 100),
        skillStats,
        duration: totalSecs,   // seconds; 0 means Assisted (not tracked)
        avgSecs,               // null if not tracked
    };
    let history = [];
    try { history = JSON.parse(localStorage.getItem(STORAGE.HISTORY)) || []; } catch(e) {}
    history.unshift(record);
    if (history.length > 50) history = history.slice(0, 50);
    try { localStorage.setItem(STORAGE.HISTORY, JSON.stringify(history)); } catch(e) {}
}

function renderHistory() {
    const container = document.getElementById('historyList');
    if (!container) return;
    let history = [];
    try { history = JSON.parse(localStorage.getItem(STORAGE.HISTORY)) || []; } catch(e) {}

    if (history.length === 0) {
        container.innerHTML = '<p class="history-empty">No sessions yet.</p>';
        return;
    }

    container.innerHTML = history.slice(0, 8).map(r => {
        const d       = new Date(r.date);
        const dateStr = d.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
        const timeStr = d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
        const labels  = r.skills.map(s => SKILL_ABBR[s] || s).join(' + ');
        const cls     = r.pct >= 80 ? 'hist-pass' : r.pct >= 60 ? 'hist-warn' : 'hist-fail';
        const timePart = r.duration > 0
            ? `<span class="hist-time">${Math.floor(r.duration/60)}m${r.duration%60}s · ${r.avgSecs}s/q</span>`
            : '';
        return `
        <div class="hist-row">
            <span class="hist-date">${dateStr} ${timeStr}</span>
            <span class="hist-skills">${labels}</span>
            ${timePart}
            <span class="hist-score ${cls}">${r.score}/${r.total} (${r.pct}%)</span>
        </div>`;
    }).join('');
}

// ══════════════════════════════════════════════════════════════════
// EXAM COUNTDOWN
// ══════════════════════════════════════════════════════════════════

function updateExamCountdown() {
    const el = document.getElementById('examCountdown');
    if (!el) return;
    const now  = new Date();
    const diff = EXAM_DATE - now;
    if (diff <= 0) { el.textContent = 'Exam day!'; el.className = 'exam-countdown'; return; }
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    el.textContent = `${days} day${days !== 1 ? 's' : ''} to PSAT`;
    el.className   = 'exam-countdown' + (days > 7 ? ' safe' : '');
}

// ══════════════════════════════════════════════════════════════════
// LIFETIME STATS
// ══════════════════════════════════════════════════════════════════

function renderLifetimeStats() {
    const container = document.getElementById('lifetimeStats');
    const section   = document.getElementById('lifetimeSection');
    if (!container || !section) return;

    let history = [];
    try { history = JSON.parse(localStorage.getItem(STORAGE.HISTORY)) || []; } catch(e) {}

    // Aggregate per-skill across all sessions
    const totals = {};
    history.forEach(r => {
        if (!r.skillStats) return;
        Object.entries(r.skillStats).forEach(([skill, s]) => {
            if (!totals[skill]) totals[skill] = { correct: 0, total: 0 };
            totals[skill].correct += s.correct;
            totals[skill].total   += s.total;
        });
    });

    if (Object.keys(totals).length === 0) {
        container.innerHTML = '<p class="lifetime-empty">Complete a session to see lifetime stats.</p>';
        section.style.display = 'block';
        return;
    }

    // Sort by accuracy ascending (weakest first)
    const sorted = Object.entries(totals)
        .sort(([, a], [, b]) => (a.correct / a.total) - (b.correct / b.total));

    container.innerHTML = sorted.map(([skill, s]) => {
        const pct = Math.round((s.correct / s.total) * 100);
        const cls = pct >= 80 ? 'lt-pass' : pct >= 60 ? 'lt-warn' : 'lt-fail';
        const bar = Math.round(pct / 5);
        return `
        <div class="lifetime-row">
            <span class="lifetime-skill">${SKILL_ABBR[skill] || skill}</span>
            <span class="lifetime-bar">${'█'.repeat(bar)}${'░'.repeat(20 - bar)}</span>
            <span class="lifetime-score ${cls}">${s.correct}/${s.total} (${pct}%)</span>
        </div>`;
    }).join('');

    section.style.display = 'block';
}

// ══════════════════════════════════════════════════════════════════
// EXPORT / IMPORT
// ══════════════════════════════════════════════════════════════════

function openExportModal() {
    let history = [];
    try { history = JSON.parse(localStorage.getItem(STORAGE.HISTORY)) || []; } catch(e) {}

    const payload = JSON.stringify({ version: 1, exported: new Date().toISOString(), history }, null, 2);

    document.getElementById('modalTitle').textContent   = 'Export Session Data';
    document.getElementById('modalDesc').textContent    =
        'Copy all the text below and send it — paste it on another device to sync progress.';
    document.getElementById('modalTextarea').value      = payload;
    document.getElementById('modalTextarea').readOnly   = true;
    document.getElementById('modalActionBtn').textContent = 'Copy to Clipboard';
    document.getElementById('modalActionBtn').onclick   = () => {
        navigator.clipboard.writeText(payload).then(() => {
            document.getElementById('modalActionBtn').textContent = 'Copied!';
            setTimeout(() => {
                document.getElementById('modalActionBtn').textContent = 'Copy to Clipboard';
            }, 2000);
        });
    };
    document.getElementById('dataModal').style.display = 'flex';
}

function openImportModal() {
    document.getElementById('modalTitle').textContent   = 'Import Session Data';
    document.getElementById('modalDesc').textContent    =
        'Paste exported data below. Existing sessions will be merged (duplicates skipped).';
    document.getElementById('modalTextarea').value      = '';
    document.getElementById('modalTextarea').readOnly   = false;
    document.getElementById('modalActionBtn').textContent = 'Import';
    document.getElementById('modalActionBtn').onclick   = () => {
        const raw = document.getElementById('modalTextarea').value.trim();
        try {
            const parsed = JSON.parse(raw);
            if (!parsed.history || !Array.isArray(parsed.history)) throw new Error('Invalid format');

            let existing = [];
            try { existing = JSON.parse(localStorage.getItem(STORAGE.HISTORY)) || []; } catch(e) {}

            // Merge: skip records with same date
            const existingDates = new Set(existing.map(r => r.date));
            const newRecords = parsed.history.filter(r => !existingDates.has(r.date));
            const merged = [...newRecords, ...existing]
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 50);

            localStorage.setItem(STORAGE.HISTORY, JSON.stringify(merged));
            document.getElementById('dataModal').style.display = 'none';
            renderHistory();
            renderLifetimeStats();
            alert(`Imported ${newRecords.length} new session${newRecords.length !== 1 ? 's' : ''}.`);
        } catch(e) {
            alert('Could not parse the data. Make sure you pasted the full exported text.');
        }
    };
    document.getElementById('dataModal').style.display = 'flex';
}

// ══════════════════════════════════════════════════════════════════
// RESIZABLE PANELS
// ══════════════════════════════════════════════════════════════════

function initResizablePanel() {
    const handle    = document.getElementById('resizeHandle');
    const leftPanel = document.querySelector('.passage-panel');
    const rightPanel= document.querySelector('.question-panel');
    const container = document.querySelector('.main-content');
    if (!handle || !leftPanel || !rightPanel) return;

    const saved = localStorage.getItem(STORAGE.SPLIT);
    if (saved) {
        leftPanel.style.flex  = 'none';
        leftPanel.style.width = saved + 'px';
        rightPanel.style.flex = '1';
    }

    let dragging = false, startX = 0, startWidth = 0;

    function startDrag(clientX) {
        dragging   = true;
        startX     = clientX;
        startWidth = leftPanel.getBoundingClientRect().width;
        document.body.style.cursor     = 'col-resize';
        document.body.style.userSelect = 'none';
    }

    function doDrag(clientX) {
        if (!dragging) return;
        const maxW = container.getBoundingClientRect().width - handle.offsetWidth;
        const newW = Math.max(240, Math.min(maxW - 300, startWidth + (clientX - startX)));
        leftPanel.style.flex  = 'none';
        leftPanel.style.width = newW + 'px';
        rightPanel.style.flex = '1';
    }

    function endDrag() {
        if (!dragging) return;
        dragging = false;
        document.body.style.cursor = document.body.style.userSelect = '';
        try { localStorage.setItem(STORAGE.SPLIT, leftPanel.getBoundingClientRect().width); } catch(e) {}
    }

    // Mouse events
    handle.addEventListener('mousedown', e => { startDrag(e.clientX); e.preventDefault(); });
    document.addEventListener('mousemove', e => doDrag(e.clientX));
    document.addEventListener('mouseup', endDrag);

    // Touch events
    handle.addEventListener('touchstart', e => { startDrag(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
    document.addEventListener('touchmove', e => { if (dragging) { doDrag(e.touches[0].clientX); e.preventDefault(); } }, { passive: false });
    document.addEventListener('touchend', endDrag);

    handle.addEventListener('dblclick', () => {
        leftPanel.style.flex = leftPanel.style.width = '';
        rightPanel.style.flex = '1';
        try { localStorage.removeItem(STORAGE.SPLIT); } catch(e) {}
    });
}

// ══════════════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════════════════════

function initKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
        if (['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;

        const onSetup      = document.getElementById('setupScreen').style.display      !== 'none';
        const onCompletion = document.getElementById('completionScreen').style.display !== 'none';
        if (onSetup || onCompletion) return;

        const key = e.key.toUpperCase();

        // Space / Enter — reveal or advance
        if (key === ' ' || key === 'ENTER') {
            e.preventDefault();
            const pred = document.getElementById('predictionStep');
            if (!pred.classList.contains('hidden')) {
                pred.classList.add('hidden');
                document.getElementById('optionsContainer').classList.remove('hidden');
            } else if (isAnswered) {
                document.getElementById('nextBtn').click();
            }
            return;
        }

        // Arrow right — advance
        if (key === 'ARROWRIGHT' && isAnswered) {
            e.preventDefault();
            document.getElementById('nextBtn').click();
            return;
        }

        // A/B/C/D or 1/2/3/4
        const letterMap = { A:'A', B:'B', C:'C', D:'D', '1':'A', '2':'B', '3':'C', '4':'D' };
        if (letterMap[key]) {
            const container = document.getElementById('optionsContainer');
            if (container.classList.contains('hidden') || isAnswered) return;
            const target = Array.from(container.querySelectorAll('.option-btn'))
                .find(b => b.innerText.trim()[0] === letterMap[key]);
            if (target) { e.preventDefault(); target.click(); }
        }
    });
}

// ══════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════

function init() {
    // Setup screen listeners
    document.querySelectorAll('input[name="skill"], input[name="diff"]')
        .forEach(el => el.addEventListener('change', updateSetupUI));
    document.getElementById('limitSelect').addEventListener('change', updateSetupUI);
    document.querySelectorAll('.preset-btn')
        .forEach(btn => btn.addEventListener('click', () => applyPreset(btn)));

    // Start session
    document.getElementById('startSessionBtn').addEventListener('click', () => {
        activeQuestions = buildActiveQuestions();
        if (activeQuestions.length === 0) return;
        reviewMode      = false;
        missedQuestions = [];
        sessionResults  = [];
        resetProgress();
        clearSessionState();
        hideSetup();
        loadQuestion(0);
        if (userMode === 'standard' || userMode === 'exam') {
            startTimer(); // track time in Standard + Exam; Assisted excluded
        }
        if (userMode === 'exam') {
            document.getElementById('timerDisplay').classList.remove('hidden');
        }
    });

    document.getElementById('changeSessionBtn').addEventListener('click', showSetup);

    document.getElementById('modeSelect').addEventListener('change', e => {
        userMode = e.target.value;
        const timerDisplay = document.getElementById('timerDisplay');
        if (userMode === 'exam') {
            timerDisplay.classList.remove('hidden');
            startTimer();
        } else {
            timerDisplay.classList.add('hidden');
            stopTimer();
        }
    });

    document.getElementById('revealChoicesBtn').addEventListener('click', () => {
        document.getElementById('predictionStep').classList.add('hidden');
        document.getElementById('optionsContainer').classList.remove('hidden');
    });

    document.getElementById('nextBtn').addEventListener('click', () => {
        currentQuestionIndex++;
        if (currentQuestionIndex < activeQuestions.length) {
            loadQuestion(currentQuestionIndex);
        } else {
            stopTimer();
            clearSessionState();
            const skills = [...new Set(activeQuestions.map(q => q.skill))];
            const diffs  = [...new Set(activeQuestions.map(q => q.difficulty))];
            logSession(skills, diffs, score, activeQuestions.length);
            showCompletion();
        }
    });

    // Completion screen
    document.getElementById('reviewMissedBtn').addEventListener('click', startReviewMissed);
    document.getElementById('newSessionBtn').addEventListener('click', () => {
        reviewMode = false;
        showSetup();
    });

    // History toggle
    document.getElementById('historyToggle').addEventListener('click', () => {
        const list    = document.getElementById('historyList');
        const chevron = document.getElementById('historyChevron');
        const open    = list.style.display !== 'none';
        list.style.display  = open ? 'none' : 'block';
        chevron.textContent = open ? '\u25b8' : '\u25be';
    });

    // Resume banner
    document.getElementById('resumeBtn').addEventListener('click', () => {
        const state = loadSessionState();
        if (state && restoreSession(state)) {
            clearSessionState();
            document.getElementById('resumeBanner').style.display = 'none';
            document.getElementById('modeSelect').value = userMode;
            hideSetup();
            loadQuestion(currentQuestionIndex);
            if (userMode === 'exam') {
                document.getElementById('timerDisplay').classList.remove('hidden');
                startTimer();
            }
        }
    });

    document.getElementById('discardBtn').addEventListener('click', () => {
        clearSessionState();
        document.getElementById('resumeBanner').style.display = 'none';
    });

    // Export / Import
    document.getElementById('exportBtn').addEventListener('click', openExportModal);
    document.getElementById('importBtn').addEventListener('click', openImportModal);
    document.getElementById('modalCloseBtn').addEventListener('click', () => {
        document.getElementById('dataModal').style.display = 'none';
    });
    document.getElementById('dataModal').addEventListener('click', e => {
        if (e.target === document.getElementById('dataModal')) {
            document.getElementById('dataModal').style.display = 'none';
        }
    });

    // Lifetime stats toggle
    document.getElementById('lifetimeToggle').addEventListener('click', () => {
        const list    = document.getElementById('lifetimeStats');
        const chevron = document.getElementById('lifetimeChevron');
        const open    = list.style.display !== 'none';
        list.style.display  = open ? 'none' : 'block';
        chevron.textContent = open ? '\u25b8' : '\u25be';
    });

    initResizablePanel();
    initKeyboardShortcuts();
    showSetup();
}

init();
