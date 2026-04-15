"""
PSAT 10 Question Extractor  — robust multi-line skill parser
Parses all 3 PDFs → 4 JS data files for the PSAT 10 Mastery App
"""

import fitz  # PyMuPDF
import re
import json
import os

# ── Skill normalisation ────────────────────────────────────────────
# Keys are lowercase, whitespace-collapsed skill strings from the PDF.
SKILL_MAP = {
    'words in context':                   'Words in Context',
    'text structure and purpose':         'Text Structure and Purpose',
    'cross-text connections':             'Cross-Text Connections',
    'rhetorical synthesis':               'Rhetorical Synthesis',
    'transitions':                        'Transitions',
    'central ideas and details':          'Central Ideas and Details',
    'command of evidence':                'Command of Evidence — Textual',  # refined below
    'inferences':                         'Inferences',
    'boundaries':                         'Boundaries',
    'form, structure, and sense':         'Form, Structure, and Sense',
}

STRATEGIES = {
    'Words in Context':                   'Two-Filter Method',
    'Text Structure and Purpose':         'Function Map',
    'Cross-Text Connections':             'Perspective Synthesis',
    'Rhetorical Synthesis':               'Goal-First Filter',
    'Transitions':                        'Direction Check',
    'Central Ideas and Details':          'Locate-and-Verify',
    'Command of Evidence — Textual':      'Evidence Match',
    'Command of Evidence — Quantitative': 'Read-the-Axis',
    'Inferences':                         'Conservative Choice',
    'Boundaries':                         'Bracket-the-Clauses',
    'Form, Structure, and Sense':         'Subject Hunt',
}

TRAP_SETS = {
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
        'Too Specific · Opposite · Outside Knowledge',
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
}

DOMAIN_FILE = {
    'Words in Context':                   'craft-structure',
    'Text Structure and Purpose':         'craft-structure',
    'Cross-Text Connections':             'craft-structure',
    'Rhetorical Synthesis':               'expression-of-ideas',
    'Transitions':                        'expression-of-ideas',
    'Central Ideas and Details':          'info-ideas',
    'Command of Evidence — Textual':      'info-ideas',
    'Command of Evidence — Quantitative': 'info-ideas',
    'Inferences':                         'info-ideas',
    'Boundaries':                         'conventions',
    'Form, Structure, and Sense':         'conventions',
}

JS_VAR = {
    'craft-structure':     'questionBank_CS',
    'expression-of-ideas': 'questionBank_EOI',
    'info-ideas':          'questionBank_II',
    'conventions':         'questionBank_CON',
}

# ── Text cleaning ──────────────────────────────────────────────────
def clean(text):
    for old, new in [
        ('\ufb01','fi'), ('\ufb02','fl'),
        ('\u2019',"'"), ('\u2018',"'"),
        ('\u201c','"'), ('\u201d','"'),
        ('\u2014','—'), ('\u2013','–'),
        ('\u00a0',' '), ('\ufffd',"'"),
        ('\xa0',' '),
    ]:
        text = text.replace(old, new)
    return text

# ── Detect CoE-Quantitative ────────────────────────────────────────
def is_quantitative(passage):
    p = passage.lower()
    # Table with numeric rows (2+ lines that are mostly numbers)
    lines = passage.split('\n')
    num_lines = sum(1 for l in lines
                    if l.strip() and re.match(r'^[\d,.\s%\-]+$', l.strip()))
    if num_lines >= 2:
        return True
    # Explicit keywords
    if re.search(r'\b(table|figure|graph|chart)\b', p) and re.search(r'\d', passage):
        return True
    # Data query pattern
    if 'which choice most effectively uses data from' in p:
        return True
    return False

# ── Normalise skill name ───────────────────────────────────────────
def normalise_skill(raw):
    # Collapse all whitespace (including newlines) to single space, lowercase
    key = ' '.join(raw.split()).lower().strip()
    # Try exact match first
    if key in SKILL_MAP:
        return SKILL_MAP[key]
    # Try prefix match (longest first)
    for k in sorted(SKILL_MAP.keys(), key=len, reverse=True):
        if key.startswith(k):
            return SKILL_MAP[k]
    return None

# ── Question-start patterns ────────────────────────────────────────
# These patterns must match at a line boundary (start of line) to avoid
# matching mid-sentence phrases inside the passage body.
Q_PATTERNS = re.compile(
    r'(?:^|\n)'                          # must be at start of line
    r'(?:'
    r'Which choice (?:best |most |completes|describes|states|identifies|reflects|characterizes|explains|logically|effectively)'
    r'|Which choice completes the text so that'
    r'|According to the (?:text|passage|table|figure|graph|data|notes)'
    r'|Based on the (?:text|passage|table|figure|data|graph|notes)'
    r'|As used in the text'
    r'|As used in context'
    r'|The (?:student|researcher|author|narrator) wants to'
    r'|A (?:student|researcher|writer) (?:wants|is|has)'
    r'|Which (?:finding|quotation|claim|detail|example|sentence)'
    r'|How (?:does|would|did|is)'
    r'|Consulting the'
    r'|The (?:text|passage|author|speaker) (?:indicates|suggests|implies|argues|claims|presents|uses|states|asserts)'
    r'|Which of the following'
    r'|If the (?:student|author|writer)'
    r')',
    re.IGNORECASE
)

# ── Parse one page ─────────────────────────────────────────────────
def parse_page(raw_text, difficulty):
    text = clean(raw_text)

    # 1. Extract question ID
    id_match = re.match(r'Question ID ([a-f0-9]+)', text)
    if not id_match:
        return None
    qid = id_match.group(1)

    # 2. Strip leading ID lines
    text = re.sub(r'^Question ID [a-f0-9]+\s*\nID:\s*[a-f0-9]+\s*\n?', '', text).strip()

    # 3. Find "ID: xxx Answer" separator
    sep = re.search(r'\nID:\s*[a-f0-9]+\s*Answer\s*\n', text)
    if not sep:
        return None

    body = text[:sep.start()].strip()
    tail = text[sep.end():].strip()

    # 4. Extract correct answer
    ans_m = re.search(r'Correct Answer:\s*\n([A-D])', tail)
    if not ans_m:
        return None
    answer = ans_m.group(1)

    # 5. Extract rationale
    rat_m = re.search(r'Rationale\s*\n(.*?)(?=Question Difficulty:|$)', tail, re.DOTALL)
    rationale = rat_m.group(1).strip() if rat_m else ''

    # 6. Extract skill — capture everything between "Skill\n" and "\nDifficulty"
    skill_m = re.search(r'\bSkill\s*\n(.*?)\nDifficulty', tail, re.DOTALL)
    if not skill_m:
        return None
    skill = normalise_skill(skill_m.group(1))
    if not skill:
        return None

    # 7. Extract options from body — find first "A. "
    opts_m = re.search(r'\nA\.\s+', body)
    if not opts_m:
        # Some questions have options without newline before A.
        opts_m = re.search(r'^A\.\s+', body, re.MULTILINE)
    if not opts_m:
        return None

    pre_opts = body[:opts_m.start()].strip()
    opts_block = body[opts_m.start():].strip()

    # Split on newline followed by B./C./D.
    opts_raw = re.split(r'\n(?=[B-D]\.\s)', opts_block)
    options = []
    for opt in opts_raw:
        # Clean up: letter. text
        opt_clean = re.sub(r'^([A-D])\.\s*', r'\1. ', opt.strip())
        opt_clean = re.sub(r'\s+', ' ', opt_clean).strip()
        # Remove trailing non-breaking space / punctuation artifacts
        opt_clean = opt_clean.rstrip('\xa0 ')
        options.append(opt_clean)

    if len(options) != 4:
        return None

    # 8. Split pre_opts into passage + question
    # Find last occurrence of a question-start pattern
    q_start = None
    for m in Q_PATTERNS.finditer(pre_opts):
        q_start = m.start()

    if q_start is not None:
        # q_start may include the leading \n — skip it
        raw_q   = pre_opts[q_start:]
        passage  = pre_opts[:q_start].strip()
        question = raw_q.lstrip('\n').strip()
    else:
        # Fallback: last non-empty paragraph
        paras = [p for p in pre_opts.split('\n\n') if p.strip()]
        if not paras:
            return None
        question = paras[-1].strip()
        passage  = '\n\n'.join(paras[:-1]).strip()

    # 9. Refine CoE: textual vs quantitative
    if skill == 'Command of Evidence — Textual':
        full_context = passage + ' ' + question
        if is_quantitative(full_context):
            skill = 'Command of Evidence — Quantitative'

    # 10. Build structured explanation
    strategy    = STRATEGIES.get(skill, 'POE')
    trap        = TRAP_SETS.get(skill, '—')
    explanation = f"Strategy: {strategy}\n{rationale}"

    return {
        'id':          qid,
        'skill':       skill,
        'difficulty':  difficulty,
        'passage':     passage,
        'question':    question,
        'options':     options,
        'answer':      answer,
        'explanation': explanation,
        'strategy':    strategy,
        'trapName':    trap,
    }

# ── Extract one PDF ────────────────────────────────────────────────
def extract_pdf(pdf_path, difficulty):
    doc = fitz.open(pdf_path)
    questions, skipped = [], 0
    for i in range(len(doc)):
        q = parse_page(doc[i].get_text(), difficulty)
        if q:
            questions.append(q)
        else:
            skipped += 1
    print(f'  {difficulty}: {len(questions)} parsed, {skipped} skipped')
    return questions

# ── Write JS ───────────────────────────────────────────────────────
def write_js(file_key, questions, out_dir):
    var  = JS_VAR[file_key]
    path = os.path.join(out_dir, f'data-{file_key}.js')
    body = json.dumps(questions, ensure_ascii=False, indent=2)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(f'const {var} = {body};\n')
    print(f'  Wrote {path} ({len(questions)} q)')

# ── Main ───────────────────────────────────────────────────────────
BASE = 'c:/Antigravity/SAT GUIDES/Joshua Omisore/PSAT QUESTIONS'
OUT  = 'c:/Antigravity/SAT GUIDES/Joshua Omisore/MasteryApp'
PDFS = [
    (f'{BASE}/PSAT 10 Easy Questions.pdf',   'Easy'),
    (f'{BASE}/PSAT 10 Medium Questions.pdf', 'Medium'),
    (f'{BASE}/PSAT 10 Hard Questions.pdf',   'Hard'),
]

os.makedirs(OUT, exist_ok=True)

all_qs = []
for path, diff in PDFS:
    print(f'Extracting {diff}...')
    all_qs.extend(extract_pdf(path, diff))

# De-duplicate by ID
seen, unique = set(), []
for q in all_qs:
    if q['id'] not in seen:
        seen.add(q['id'])
        unique.append(q)

print(f'\nTotal unique: {len(unique)}')

# Bucket by domain file
buckets = {k: [] for k in JS_VAR}
for q in unique:
    fkey = DOMAIN_FILE.get(q['skill'])
    if fkey:
        buckets[fkey].append(q)

print('\nBreakdown:')
for fkey, qs in buckets.items():
    by_skill = {}
    for q in qs:
        by_skill[q['skill']] = by_skill.get(q['skill'], 0) + 1
    print(f'  [{fkey}] {len(qs)} total')
    for s, c in sorted(by_skill.items()):
        print(f'    {c:3d}  {s}')

print('\nWriting JS...')
for fkey, qs in buckets.items():
    write_js(fkey, qs, OUT)

print('\nDone.')
