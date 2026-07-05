// Fableux statusline — linha fixa sob o prompt do Claude Code (custo zero de
// tokens: é só UI, nada entra no contexto). Recebe o JSON de status no stdin
// e soma .fableux/cache/economia.jsonl (sessão atual vs. total).

import fs from 'node:fs';

const LOG = '.fableux/cache/economia.jsonl';
const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`);

// Contexto real da sessão: lê o rabo do transcript e pega o usage da última
// resposta da API (input + cache = o que a janela está custando por turno).
function contextoAtual(transcriptPath) {
  try {
    const fd = fs.openSync(transcriptPath, 'r');
    const tam = fs.fstatSync(fd).size;
    const len = Math.min(tam, 262144);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, tam - len);
    fs.closeSync(fd);
    for (const linha of buf.toString('utf8').split('\n').reverse()) {
      if (!linha.includes('"usage"')) continue;
      try {
        const u = JSON.parse(linha).message?.usage;
        if (u && u.input_tokens != null) {
          return (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
        }
      } catch { /* linha parcial */ }
    }
  } catch { /* sem transcript */ }
  return null;
}

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
  const AM = (t) => `\x1b[33m${t}\x1b[0m`;
  const VM = (t) => `\x1b[31m${t}\x1b[0m`;

  // O terminal trunca a statusline na largura da tela: segmentos curtos e no
  // máximo UM aviso por vez, em ordem de urgência.
  let ctx = '';
  let aviso = '';
  const usados = data.transcript_path ? contextoAtual(data.transcript_path) : null;
  if (usados) {
    const janela = /\[1m\]/.test(data.model?.id || '') ? 1_000_000 : 200_000;
    const pct = Math.round((usados / janela) * 100);
    ctx = `ctx ${pct}%`;
    if (pct >= 80) { ctx = VM(ctx); aviso = VM('⚠ AGORA /clear ou /compact'); }
    else if (pct >= 60) { ctx = AM(ctx); aviso = AM('⚠ /compact na pausa'); }
    // janela 1M: acima de 200k tokens o preço por token dobra
    else if (janela === 1_000_000 && usados >= 180_000) aviso = AM('⚠ >200k preço 2x → /clear');
  }
  if (!aviso) {
    try {
      const nPerm = fs.readFileSync('.fableux/cache/permissoes.jsonl', 'utf8')
        .split('\n').filter((l) => l.includes(`"${sid}"`)).length;
      if (nPerm >= 5) aviso = AM(`⚠ /fewer-permission-prompts (${nPerm} pedidos)`);
    } catch { /* sem contador ainda */ }
  }
  if (!aviso) {
    try {
      const allow = JSON.parse(fs.readFileSync('.claude/settings.local.json', 'utf8')).permissions?.allow || [];
      if (allow.length >= 20) aviso = AM(`⚠ /fewer-permission-prompts (${allow.length} regras)`);
    } catch { /* sem settings local */ }
  }

  const partes = [
    `\x1b[36m⚡\x1b[0m ${modelo}${desligado ? AM(' ⏸') : ''}`,
    ctx,
    nTotal > 0 ? `\x1b[32m▼${fmt(tokSessao)}\x1b[0m·${fmt(tokTotal)}` : '',
    typeof custo === 'number' ? `$${custo.toFixed(2)}` : '',
    aviso,
  ];
  console.log(partes.filter(Boolean).join(' \x1b[90m|\x1b[0m '));
});
