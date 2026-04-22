import json, re

SCIENCE_KEYWORDS = [
    'cell','cells','dna','rna','gene','genes','genetic','genome','protein','proteins',
    'enzyme','enzymes','organism','organisms','bacteria','virus','viral','species',
    'evolution','evolutionary','fossil','fossils','neuron','neurons','dopamine',
    'cortex','brain','neural','nervous','photosynthesis','chlorophyll','mitosis',
    'ecosystem','habitat','predator','prey','symbiosis','microbe','microbiome',
    'algae','fungi','spore','pollen','chromosome','mutation','antibody','immune',
    'metabol','respir','digest','circulat','cardiovascular','vascular','mammal',
    'atom','atomic','molecule','molecular','chemical','compound','element','isotope',
    'reaction','bond','electron','proton','neutron','orbit','orbital','telescope',
    'galaxy','galaxies','star','stellar','planet','planetary','moon','lunar','solar',
    'comet','asteroid','supernova','black hole','gravitational','gravity','quantum',
    'photon','laser','wavelength','spectrum','radiation','magnetic','electromagnetic',
    'temperature','thermodynamic','entropy','catalyst','oxidation','carbon dioxide',
    'nitrogen','oxygen','hydrogen','calcium','sodium','iron','mineral','crystal',
    'tectonic','earthquake','volcano','erosion','sediment','glacier','ice core',
    'atmosphere','climate','precipitation','drought','biodiversity','extinction',
    'pollut','emission','carbon','coral reef','ocean','marine','aquatic','freshwater',
    'soil','geolog','patient','clinical','trial','diagnosis','therapy','treatment',
    'symptom','disease','disorder','syndrome','cognitive','memory','sleep',
    'serotonin','cortisol','inflammation','blood','pulse','heart rate',
    'velocity','acceleration','force','mass','energy','heat','light','sound',
    'frequency','amplitude','circuit','voltage','current','semiconductor',
    'computer','algorithm','sensor','robot','spacecraft','satellite','physics',
    'biology','chemistry','astronomy','ecology','neuroscience','botany','zoology',
    'entomology','insect','arthropod','primate','mammal','reptile','amphibian',
]

SOCIAL_KEYWORDS = [
    'econom','market','trade','labor','workforce','unemployment','inflation',
    'income','wealth','poverty','inequality','fiscal','monetary','gdp','tax',
    'government','policy','legislation','congress','senate','democracy',
    'election','vote','political','diplomac','war','conflict','military',
    'international','treaty','sanction','refugee','immigr','urban','rural',
    'census','demographic','population','survey','statistic','sociology',
    'community','institution','public health','healthcare','education','school',
    'curriculum','student','teacher','achievement','race','gender','class',
    'discrimination','civil rights','protest','reform','psychology','behavior',
    'cognitive bias','experiment','participant','findings','results','data show',
    'correlation','significant','researcher','study participants','subjects',
]

HUMANITIES_KEYWORDS = [
    'poem','poetry','poet','novel','novelist','fiction','narrative','character',
    'author','literary','literature','metaphor','imagery','symbolism','theme',
    'rhetoric','essay','memoir','biography','autobiography','prose','verse',
    'painting','sculpture','artwork','museum','gallery','architect','architecture',
    'composer','symphony','opera','musical','theater','performance','dance',
    'philosophy','philosopher','ethics','moral','aesthetic','epistemolog',
    'historian','history','ancient','medieval','renaissance','colonialism',
    'empire','dynasty','culture','tradition','mythology','religion','theology',
    'language','linguistic','grammar','dialect','translation',
]

HUMANITIES_VETO = [
    'poem','poetry','poet','novel','fiction','short story','playwright',
    'directed','director','film','painting','sculpture','artwork','gallery',
    'museum','composer','symphony','opera','musician','theater','theatre',
    'philosopher','philosophy','mythology','theology','memoir','biography',
    'autobiography','narrator','speaker','character','protagonist','stanza',
    'literary','metaphor','imagery','allusion','the following text is from',
]

def classify_topic(text):
    if not text:
        return 'other'
    t = text.lower()

    # Humanities veto: strong literary/arts signals override science keywords
    veto_hits = sum(1 for kw in HUMANITIES_VETO if kw in t)
    if veto_hits >= 2:
        return 'humanities'

    sci = sum(1 for kw in SCIENCE_KEYWORDS if kw in t)
    soc = sum(1 for kw in SOCIAL_KEYWORDS  if kw in t)
    hum = sum(1 for kw in HUMANITIES_KEYWORDS if kw in t)

    # Require science to win clearly (score >= 3 AND beat social by at least 2)
    if sci >= 3 and sci >= soc + 2 and sci > hum:
        return 'science'

    best = max(sci, soc, hum)
    if best == 0:
        return 'other'
    if sci == best and sci >= 2:
        return 'science'
    if soc == best:
        return 'social'
    if hum == best:
        return 'humanities'
    return 'other'

FILES = [
    ('questionBank_II',  'data-info-ideas.js'),
    ('questionBank_CS',  'data-craft-structure.js'),
    ('questionBank_EOI', 'data-expression-of-ideas.js'),
    ('questionBank_CON', 'data-conventions.js'),
]

BASE = 'c:/Antigravity/SAT GUIDES/Joshua Omisore/MasteryApp/'
totals = {'science': 0, 'social': 0, 'humanities': 0, 'other': 0}

for varname, fname in FILES:
    fpath = BASE + fname
    with open(fpath, 'r', encoding='utf-8') as f:
        raw = f.read()
    body = re.sub(r'^const ' + varname + r'\s*=\s*', '', raw.strip()).rstrip(';').strip()
    data = json.loads(body)
    for q in data:
        topic = classify_topic(q.get('passage', '') or '')
        q['topic'] = topic
        totals[topic] += 1
    out = 'const ' + varname + ' = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n'
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(out)
    print(fname + ': ' + str(len(data)) + ' questions tagged')

print('\nTopic distribution:')
for t, n in sorted(totals.items(), key=lambda x: -x[1]):
    print('  ' + t + ': ' + str(n))
