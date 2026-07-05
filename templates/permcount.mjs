// Fableux permcount — hook Notification: conta pedidos de permissão da sessão
// em .fableux/cache/permissoes.jsonl. A statusline usa o contador para sugerir
// /fewer-permission-prompts quando a fricção acumula. Nunca bloqueia nada.

import fs from 'node:fs';

let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  try {
    const d = JSON.parse(input);
    if (!/permiss/i.test(d.message || '')) process.exit(0);
    fs.mkdirSync('.fableux/cache', { recursive: true });
    fs.appendFileSync('.fableux/cache/permissoes.jsonl',
      JSON.stringify({ t: new Date().toISOString(), sid: d.session_id }) + '\n');
  } catch { /* hook de contagem nunca pode falhar barulhento */ }
  process.exit(0);
});
