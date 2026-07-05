// Fableux verificar — hook Stop: antes de o modelo encerrar o turno, roda
// node --check em todo .js/.mjs/.cjs editado na sessão. Se algum falhar,
// bloqueia o encerramento (saída 2) devolvendo o erro verbatim para correção.
// Loop objetivo: só volta quando há erro REAL, com teto de 2 voltas por rodada
// para nunca virar loop infinito. Checagens passando = encerra normal.

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

if (process.env.FABLEUX_OFF === '1' || fs.existsSync('.fableux/off')) process.exit(0);

const CONTADOR = '.fableux/cache/verificacoes.json';
const JS = /\.(js|mjs|cjs)$/i;
const LIXO = /node_modules|[\\/]dist[\\/]|[\\/]build[\\/]|\.min\.js$/;

let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { process.exit(0); }
  const sid = data.session_id || '';

  // Arquivos editados na sessão: varre o transcript atrás de Edit/Write.
  const editados = new Set();
  try {
    for (const linha of fs.readFileSync(data.transcript_path, 'utf8').split('\n')) {
      if (!linha.includes('"tool_use"')) continue;
      let obj; try { obj = JSON.parse(linha); } catch { continue; }
      for (const c of obj.message?.content || []) {
        if (c.type !== 'tool_use') continue;
        if (c.name === 'Edit' || c.name === 'Write') {
          const fp = c.input?.file_path || '';
          if (JS.test(fp) && !LIXO.test(fp)) editados.add(fp);
        }
      }
    }
  } catch { process.exit(0); /* sem transcript: não atrapalha */ }
  if (!editados.size) process.exit(0);

  const falhas = [];
  for (const fp of editados) {
    if (!fs.existsSync(fp)) continue;
    try {
      execFileSync(process.execPath, ['--check', fp], { timeout: 10000, stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (e) {
      falhas.push(`--- ${fp} ---\n${(e.stderr || e.message || '').toString().trim().slice(0, 2000)}`);
    }
  }

  let cont = {};
  try { cont = JSON.parse(fs.readFileSync(CONTADOR, 'utf8')); } catch { /* primeiro uso */ }

  if (!falhas.length) {
    // tudo passou: zera o teto para a próxima rodada e deixa encerrar
    if (cont[sid]) { delete cont[sid]; gravou(cont); }
    process.exit(0);
  }

  // teto: no máximo 2 bloqueios consecutivos — depois disso o problema é maior
  // que sintaxe e segurar o turno só queima tokens; devolve ao usuário.
  const n = (cont[sid]?.n || 0) + 1;
  if (n > 2) {
    delete cont[sid]; gravou(cont);
    process.exit(0);
  }
  cont[sid] = { n, t: Date.now() };
  gravou(cont);

  console.error(`Fableux verificar: node --check falhou em ${falhas.length} arquivo(s) editado(s) nesta sessão. Corrija antes de encerrar (tentativa ${n}/2):\n\n${falhas.join('\n\n')}`);
  process.exit(2);
});

function gravou(cont) {
  try {
    fs.mkdirSync('.fableux/cache', { recursive: true });
    fs.writeFileSync(CONTADOR, JSON.stringify(cont));
  } catch { /* contador nunca pode quebrar o hook */ }
}
