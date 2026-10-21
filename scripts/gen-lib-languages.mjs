// Generates language files for our own H5P libraries (AppSimulation, Scenario) for every built-in course
// language that has no hand-made file yet. Labels/descriptions stay English (the editor UI is DE/EN only);
// only learner-facing defaults are translated, from src/export/labels.js.
// Usage: node scripts/gen-lib-languages.mjs
import fs from 'node:fs';
import path from 'node:path';
import { APPSIM, SCENARIO } from '../src/export/labels.js';

const LIBS = [
  ['H5P.AppSimulation-1.0', APPSIM],
  ['H5P.Scenario-1.0', SCENARIO]
];

function translate(fields, texts, lang, trail = []) {
  return fields.map((f) => {
    const out = {};
    if (f.label !== undefined) out.label = f.label;
    if (f.description !== undefined) out.description = f.description;
    const here = [...trail, f.name];
    if (f.type === 'text' && typeof f.default === 'string') {
      const key = here.join('/');
      if (here[0] === 'l10n' && texts[f.name] !== undefined) out.default = texts[f.name];
      else if (key === 'intro/kicker' && texts.kicker) out.default = texts.kicker;
      else if (f.name === 'captionsLanguage') out.default = lang;
      else out.default = f.default;
    }
    if (Array.isArray(f.options)) out.options = f.options.map((o) => ({ label: o.label }));
    if (Array.isArray(f.fields)) out.fields = translate(f.fields, texts, lang, here);
    if (f.field) out.field = translate([f.field], texts, lang, here)[0];
    return out;
  });
}

for (const [lib, table] of LIBS) {
  const dir = path.join('h5p/libraries', lib);
  const semantics = JSON.parse(fs.readFileSync(path.join(dir, 'semantics.json'), 'utf8'));
  for (const [lang, texts] of Object.entries(table)) {
    const file = path.join(dir, 'language', `${lang}.json`);
    fs.writeFileSync(file, JSON.stringify({ semantics: translate(semantics, texts, lang) }, null, 2) + '\n');
    console.log('wrote', file);
  }
}
