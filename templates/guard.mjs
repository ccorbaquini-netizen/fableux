// Fableux guard — hook PreToolUse que TORNA DETERMINÍSTICA a economia de leitura:
// bloqueia Read integral de arquivo grande (sem offset/limit) e leitura de lixo.
// Saída 2 = bloqueia e devolve a instrução ao modelo; 0 = permite.

import fs from 'node:fs';
import { digestFor } from './digest.mjs';

// Interruptor: FABLEUX_OFF=1 no ambiente, ou o arquivo-marcador .fableux/off
// (criável/removível no meio da sessão — o hook roda fresco a cada Read).
// Use para refatoração ampla/auditoria, onde visão integral vale o custo.
if (process.env.FABLEUX_OFF === '1' || fs.existsSync('.fableux/off')) process.exit(0);

// 600: bloqueia só leituras realmente caras — limiar baixo demais gera ciclos
// de retry (turno extra + churn de cache) que custam mais do que economizam.
// Ajustável por projeto via FABLEUX_LIMITE.
const LIMITE_LINHAS = Number(process.env.FABLEUX_LIMITE) > 0 ? Number(process.env.FABLEUX_LIMITE) : 600;
const LIXO = /node_modules|[\\/]dist[\\/]|[\\/]build[\\/]|package-lock\.json|yarn\.lock|pnpm-lock|\.min\.(js|css)$|\.map$/;

// Cada bloqueio vira uma linha JSONL; a statusline soma para exibir o ganho.
// Estimativa: 1 token ≈ 4 chars; desconta o custo do digest + ~1000 tok da
// leitura direcionada que ainda vai acontecer.
function logEconomia(sid, arquivo, tipo, linhas, tok) {
  try {
    fs.mkdirSync('.fableux/cache', { recursive: true });
    fs.appendFileSync('.fableux/cache/economia.jsonl',
      JSON.stringify({ t: new Date().toISOString(), sid, arquivo, tipo, linhas, tok: Math.max(0, Math.round(tok)) }) + '\n');
  } catch { /* log nunca pode quebrar o hook */ }
}

// Registro de leituras integrais da sessão: sid|caminho -> {mtime, pos, t}.
// "pos" é o tamanho do transcript no momento da leitura: se depois disso houve
// compactação (/compact), o conteúdo saiu da memória do modelo e a releitura
// volta a ser legítima — só se bloqueia releitura de arquivo inalterado E
// ainda presente no contexto.
const LEITURAS = '.fableux/cache/leituras.json';

function lerRegistro() {
  try { return JSON.parse(fs.readFileSync(LEITURAS, 'utf8')); } catch { return {}; }
}

function gravarRegistro(reg) {
  try {
    const chaves = Object.keys(reg);
    if (chaves.length > 300) {
      for (const k of chaves.sort((a, b) => (reg[a].t || 0) - (reg[b].t || 0)).slice(0, chaves.length - 300)) delete reg[k];
    }
    fs.mkdirSync('.fableux/cache', { recursive: true });
    fs.writeFileSync(LEITURAS, JSON.stringify(reg));
  } catch { /* registro nunca pode quebrar o hook */ }
}

// Houve /compact desde a posição "pos" do transcript? Lê só o trecho novo.
function compactouDesde(transcriptPath, pos) {
  try {
    const tam = fs.statSync(transcriptPath).size;
    if (tam < pos) return true; // transcript encolheu/trocou: assume novo contexto
    if (tam === pos) return false;
    const fd = fs.openSync(transcriptPath, 'r');
    const buf = Buffer.alloc(tam - pos);
    fs.readSync(fd, buf, 0, buf.length, pos);
    fs.closeSync(fd);
    // Casa a forma JSON estrutural (aspas sem escape = entrada de nível de
    // topo do transcript). Conteúdo de arquivo lido vai para o transcript com
    // aspas escapadas (\"), então texto que cita esses campos não dispara.
    return /"subtype":"compact_boundary"|"isCompactSummary":true/.test(buf.toString('utf8'));
  } catch { return true; } // sem transcript legível: não bloqueia releitura
}

let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { process.exit(0); }
  if (data.tool_name !== 'Read') process.exit(0);

  const p = data.tool_input?.file_path || '';
  if (LIXO.test(p)) {
    let bytes = 0;
    try { bytes = fs.statSync(p).size; } catch { /* sem stat, loga sem estimativa */ }
    logEconomia(data.session_id, p, 'lixo', null, bytes / 4);
    console.error(`Fableux guard: "${p}" é artefato/lixo — não leia; use grep se precisar de algo específico.`);
    process.exit(2);
  }
  if (data.tool_input?.limit || data.tool_input?.offset) process.exit(0);
  try {
    const conteudo = fs.readFileSync(p, 'utf8');
    const linhas = conteudo.split('\n').length;

    // Releitura: mesmo arquivo, mesma sessão, mtime igual, sem /compact no meio
    // → o conteúdo ainda está no contexto do modelo; reler só duplica tokens.
    const mtime = fs.statSync(p).mtimeMs;
    const chave = `${data.session_id}|${p}`;
    const reg = lerRegistro();
    const ant = reg[chave];
    if (ant && ant.mtime === mtime && data.transcript_path && !compactouDesde(data.transcript_path, ant.pos)) {
      logEconomia(data.session_id, p, 'releitura', linhas, conteudo.length / 4);
      console.error(`Fableux guard: você já leu "${p}" integralmente nesta sessão e ele não mudou desde então — o conteúdo ainda está no seu contexto; use-o. Para conferir um trecho específico, use Read com offset/limit.`);
      process.exit(2);
    }

    if (linhas > LIMITE_LINHAS) {
      // Gera o digest na hora do bloqueio: o modelo recebe o mapa pronto em vez
      // de gastar um turno com grep às cegas.
      let dica = 'localize antes com grep';
      let charsDigest = 0;
      try {
        const { cachePath } = digestFor(p);
        charsDigest = fs.statSync(cachePath).size;
        dica = `leia o mapa estrutural em "${cachePath}" (assinaturas + nº de linha) e então leia só o intervalo necessário`;
      } catch { /* digest falhou (binário/permissão): mantém a dica de grep */ }
      logEconomia(data.session_id, p, 'grande', linhas, (conteudo.length - charsDigest) / 4 - 1000);
      console.error(`Fableux guard: "${p}" tem ${linhas} linhas. Não leia integral — ${dica}, com Read offset/limit. Releia integral só se realmente for editar o arquivo inteiro.`);
      process.exit(2);
    }

    // Leitura integral permitida: registra para detectar releitura futura.
    let pos = 0;
    try { pos = data.transcript_path ? fs.statSync(data.transcript_path).size : 0; } catch { /* sem transcript */ }
    reg[chave] = { mtime, pos, t: Date.now() };
    gravarRegistro(reg);
  } catch { /* arquivo inexistente/binário: deixa o Read falhar sozinho */ }
  process.exit(0);
});
