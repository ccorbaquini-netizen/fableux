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

let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { process.exit(0); }
  if (data.tool_name !== 'Read') process.exit(0);

  const p = data.tool_input?.file_path || '';
  if (LIXO.test(p)) {
    try {
      const bytes = fs.statSync(p).size;
      logEconomia(data.session_id, p, 'lixo', null, bytes / 4);
    } catch { /* sem stat, loga sem estimativa */ }
    console.error(`Fableux guard: "${p}" é artefato/lixo — não leia; use grep se precisar de algo específico.`);
    process.exit(2);
  }
  if (data.tool_input?.limit || data.tool_input?.offset) process.exit(0);
  try {
    const conteudo = fs.readFileSync(p, 'utf8');
    const linhas = conteudo.split('\n').length;
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
  } catch { /* arquivo inexistente/binário: deixa o Read falhar sozinho */ }
  process.exit(0);
});
