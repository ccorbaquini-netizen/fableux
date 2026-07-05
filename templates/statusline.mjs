// Fableux statusline — até duas linhas sob o prompt do Claude Code (custo zero
// de tokens: é só UI, nada entra no contexto). Linha 1: telemetria compacta.
// Linha 2: um conselho por vez, escrito por extenso, na ordem de urgência —
// cortado na largura real do terminal (env COLUMNS, Claude Code >= 2.1.153).

import fs from 'node:fs';

const LOG = '.fableux/cache/economia.jsonl';
const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`);

// Fallback para Claude Code antigo (sem context_window no stdin): lê o rabo do
// transcript e pega o usage da última resposta da API.
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

  let tokSessao = 0, tokTotal = 0, nTotal = 0;
  try {
    for (const linha of fs.readFileSync(LOG, 'utf8').split('\n')) {
      if (!linha.trim()) continue;
      try {
        const e = JSON.parse(linha);
        tokTotal += e.tok || 0; nTotal++;
        if (e.sid === sid) tokSessao += e.tok || 0;
      } catch { /* linha corrompida: ignora */ }
    }
  } catch { /* sem log ainda */ }

  const desligado = process.env.FABLEUX_OFF === '1' || fs.existsSync('.fableux/off');
  const custo = data.cost?.total_cost_usd;
  const AM = (t) => `\x1b[33m${t}\x1b[0m`;
  const VM = (t) => `\x1b[31m${t}\x1b[0m`;

  // Contexto: versões novas do Claude Code mandam pronto em context_window;
  // senão, calcula a partir do transcript.
  let pct = null, usados = null, janela = null;
  const cw = data.context_window;
  if (cw && cw.used_percentage != null) {
    janela = cw.context_window_size || 200_000;
    pct = Math.round(cw.used_percentage);
    usados = (cw.total_input_tokens || 0) + (cw.total_output_tokens || 0);
  } else if (data.transcript_path) {
    usados = contextoAtual(data.transcript_path);
    if (usados) {
      janela = /\[1m\]/.test(data.model?.id || '') ? 1_000_000 : 200_000;
      pct = Math.round((usados / janela) * 100);
    }
  }

  // Limites de uso do plano (janelas de 5 horas e 7 dias), quando informados.
  const rl5 = data.rate_limits?.five_hour;
  const rl7 = data.rate_limits?.seven_day;
  const hora = (epoch) => {
    const d = new Date(epoch * 1000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // Linha 2: UM conselho por vez, por extenso, em ordem de urgência.
  let aviso = '', corAviso = AM;
  if (pct != null && pct >= 80) {
    corAviso = VM;
    aviso = `Contexto ${pct}% cheio — digite /compact (resume e continua) ou /clear (recomeça do zero) AGORA.`;
  } else if (rl5 && rl5.used_percentage >= 85) {
    if (rl5.used_percentage >= 95) corAviso = VM;
    aviso = `Limite de 5 horas ${Math.round(rl5.used_percentage)}% usado — libera às ${rl5.resets_at ? hora(rl5.resets_at) : '?'}; deixe o restante para o essencial.`;
  } else if (pct != null && pct >= 60) {
    aviso = `Contexto ${pct}% cheio — quando pausar, digite /compact para resumir a conversa e liberar espaço.`;
  } else if (janela === 1_000_000 && usados >= 180_000) {
    aviso = 'Passando de 200 mil tokens o preço por token dobra — digite /clear se puder trocar de assunto.';
  } else if (rl7 && rl7.used_percentage >= 90) {
    aviso = `Limite semanal ${Math.round(rl7.used_percentage)}% usado — priorize só o essencial até o reset.`;
  } else if (desligado) {
    aviso = 'Fableux pausado — apague o arquivo .fableux/off para voltar a economizar tokens.';
  }
  if (!aviso) {
    try {
      const nPerm = fs.readFileSync('.fableux/cache/permissoes.jsonl', 'utf8')
        .split('\n').filter((l) => l.includes(`"${sid}"`)).length;
      if (nPerm >= 5) aviso = `Você já confirmou ${nPerm} permissões nesta sessão — digite /fewer-permission-prompts para reduzir as interrupções.`;
    } catch { /* sem contador ainda */ }
  }
  if (!aviso) {
    try {
      const allow = JSON.parse(fs.readFileSync('.claude/settings.local.json', 'utf8')).permissions?.allow || [];
      if (allow.length >= 20) aviso = `${allow.length} regras de permissão acumuladas — digite /fewer-permission-prompts para limpar e consolidar a lista.`;
    } catch { /* sem settings local */ }
  }

  const corCtx = pct >= 80 ? VM : pct >= 60 ? AM : (t) => t;
  const partes = [
    `\x1b[36m⚡\x1b[0m ${modelo}${desligado ? AM(' ⏸') : ''}`,
    pct != null ? corCtx(`contexto ${pct}%`) : '',
    nTotal > 0 ? `\x1b[32mpoupou ${fmt(tokSessao)}\x1b[0m · ${fmt(tokTotal)} total` : '',
    typeof custo === 'number' ? `$${custo.toFixed(2)}` : '',
  ];
  console.log(partes.filter(Boolean).join(' \x1b[90m|\x1b[0m '));

  if (aviso) {
    // corta no terminal para nunca quebrar/truncar no meio de uma palavra-chave
    const cols = Number(process.env.COLUMNS) || 0;
    if (cols > 12 && aviso.length + 2 > cols) aviso = aviso.slice(0, cols - 3) + '…';
    console.log(corAviso(`⚠ ${aviso}`));
  }
});
