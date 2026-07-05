// Fableux statusline — linha fixa sob o prompt do Claude Code (custo zero de
// tokens: é só UI, nada entra no contexto). Recebe o JSON de status no stdin
// e soma .fableux/cache/economia.jsonl (sessão atual vs. total).

import fs from 'node:fs';

const LOG = '.fableux/cache/economia.jsonl';
const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`);

let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  let data = {};
  try { data = JSON.parse(input); } catch { /* segue com defaults */ }
  const sid = data.session_id;
  const modelo = data.model?.display_name || '';

  let tokSessao = 0, tokTotal = 0, nSessao = 0, nTotal = 0;
  try {
    for (const linha of fs.readFileSync(LOG, 'utf8').split('\n')) {
      if (!linha.trim()) continue;
      try {
        const e = JSON.parse(linha);
        tokTotal += e.tok || 0; nTotal++;
        if (e.sid === sid) { tokSessao += e.tok || 0; nSessao++; }
      } catch { /* linha corrompida: ignora */ }
    }
  } catch { /* sem log ainda */ }

  const desligado = process.env.FABLEUX_OFF === '1' || fs.existsSync('.fableux/off');
  const custo = data.cost?.total_cost_usd;
  const partes = [
    `\x1b[36m⚡ Fableux\x1b[0m${desligado ? ' \x1b[33m⏸ guard OFF\x1b[0m' : ''}`,
    modelo,
    nTotal === 0
      ? 'sem bloqueios ainda'
      : `poupado ~\x1b[32m${fmt(tokSessao)}\x1b[0m tok na sessão (${nSessao}) · ~${fmt(tokTotal)} total (${nTotal})`,
  ];
  if (typeof custo === 'number') partes.push(`$${custo.toFixed(2)}`);
  console.log(partes.filter(Boolean).join(' \x1b[90m|\x1b[0m '));
});
