import json, re

BASE = 'c:/Antigravity/SAT GUIDES/Joshua Omisore/MasteryApp/'

with open(BASE + 'data-info-ideas.js', 'r', encoding='utf-8') as f:
    raw = f.read()
body = re.sub(r'^const questionBank_II\s*=\s*', '', raw.strip()).rstrip(';').strip()
data = json.loads(body)

# Show topic breakdown for Evidence + Inference only
target_skills = ['Command of Evidence — Textual', 'Inferences']
subset = [q for q in data if q['skill'] in target_skills]

by_topic = {}
for q in subset:
    t = q['topic']
    by_topic.setdefault(t, []).append(q)

print('Evidence + Inference topic breakdown:')
for t, qs in sorted(by_topic.items(), key=lambda x: -len(x[1])):
    print(f'  {t}: {len(qs)}')

print('\n--- Sample SCIENCE passages (first 5 chars of passage) ---')
for q in by_topic.get('science', [])[:8]:
    snippet = (q.get('passage') or '')[:120].replace('\n',' ')
    print(f'  [{q["skill"][:6]} {q["difficulty"]}] {snippet}')

print('\n--- Sample NON-science passages tagged as science (check these) ---')
# Show "social" and "humanities" for spot-check
for topic in ('social', 'humanities', 'other'):
    qs = by_topic.get(topic, [])
    print(f'\n  Topic={topic} ({len(qs)} questions):')
    for q in qs[:4]:
        snippet = (q.get('passage') or '')[:120].replace('\n',' ')
        print(f'    [{q["skill"][:6]} {q["difficulty"]}] {snippet}')
