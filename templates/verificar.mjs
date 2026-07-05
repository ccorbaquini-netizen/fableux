// Fableux verificar — hook Stop: antes de o modelo encerrar o turno, roda
// node --check em todo .js/.mjs/.cjs editado na sessão e, se algum .ts foi
// editado, o tsc DO PROJETO com baseline (bloqueia só erro novo). Se algo
// falhar, bloqueia o encerramento (saída 2) devolvendo o erro verbatim.
// Loop objetivo: só volta quando há erro REAL, com teto de 2 voltas por rodada
// para nunca virar loop infinito. Checagens passando = encerra normal.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

if (process.env.FABLEUX_OFF === '1' || fs.existsSync('.fableux/off')) process.exit(0);

const CONTADOR = '.fableux/cache/verificacoes.json';
const JS = /\.(js|mjs|cjs)$/i;
const TS = /\.(ts|tsx|mts|cts)$/i;
const LIXO = /node_modules|[\\/]dist[\\/]|[\\/]build[\\/]|\.min\.js$/;

let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { process.exit(0); }
  const sid = data.session_id || '';

  // Arquivos editados na sessão: varre o transcript atrás de Edit/Write.
  const editados = new Set();
  const tsEditados = new Set();
  try {
    for (const linha of fs.readFileSync(data.transcript_path, 'utf8').split('\n')) {
      if (!linha.includes('"tool_use"')) continue;
      let obj; try { obj = JSON.parse(linha); } catch { continue; }
      for (const c of obj.message?.content || []) {
        if (c.type !== 'tool_use') continue;
        if (c.name === 'Edit' || c.name === 'Write') {
          const fp = c.input?.file_path || '';
          if (LIXO.test(fp)) continue;
          if (JS.test(fp)) editados.add(fp);
          else if (TS.test(fp)) tsEditados.add(fp);
        }
      }
    }
  } catch { process.exit(0); /* sem transcript: não atrapalha */ }
  if (!editados.size && !tsEditados.size) process.exit(0);

  const falhas = [];
  for (const fp of editados) {
    if (!fs.existsSync(fp)) continue;
    try {
      execFileSync(process.execPath, ['--check', fp], { timeout: 10000, stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (e) {
      falhas.push(`--- ${fp} ---\n${(e.stderr || e.message || '').toString().trim().slice(0, 2000)}`);
    }
  }

  // TypeScript: roda o tsc DO PROJETO (nunca um global — versão errada gera
  // falso positivo) quando algum .ts foi editado E existe tsconfig.json.
  // Bloqueia só erro NOVO em relação à baseline: projeto com erros antigos não
  // vira ruído; erro que some da saída sai da baseline e não volta a ser tolerado.
  if (tsEditados.size && fs.existsSync('tsconfig.json')) {
    const tscJs = path.join('node_modules', 'typescript', 'lib', 'tsc.js');
    if (fs.existsSync(tscJs)) {
      const rodaTsc = (args) => {
        try { return execFileSync(process.execPath, [tscJs, ...args], { timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }).toString(); }
        catch (e) { return e.stdout ? e.stdout.toString() : null; }
      };
      let saida = rodaTsc(['--noEmit', '--pretty', 'false', '--incremental', '--tsBuildInfoFile', '.fableux/cache/ts.tsbuildinfo']);
      // erro TS50xx = opção conflita com o tsconfig (composite etc.): roda puro
      if (saida !== null && /error TS5\d{3}/.test(saida)) saida = rodaTsc(['--noEmit', '--pretty', 'false']);
      if (saida !== null) { // tsc travou/estourou timeout: falha aberto, nunca segura o turno
        // normaliza sem linha/coluna — mover código não reintroduz erro antigo
        const atuais = [];
        for (const l of saida.split('\n')) {
          const m = l.match(/^(.*?)\(\d+,\d+\): (error TS\d+: .*)$/) || l.match(/^(error TS\d+: .*)$/);
          if (m) atuais.push(m[2] ? `${m[1]}: ${m[2]}` : m[1]);
        }
        const BASE = '.fableux/cache/ts-baseline.json';
        let baseline = null;
        try { baseline = JSON.parse(fs.readFileSync(BASE, 'utf8')); } catch { /* primeira rodada */ }
        if (baseline === null) {
          gravaBaseline(BASE, atuais); // erros pré-existentes: registra e não bloqueia
        } else {
          const conhecidos = new Set(baseline);
          const novos = atuais.filter((c) => !conhecidos.has(c));
          gravaBaseline(BASE, atuais.filter((c) => conhecidos.has(c)));
          if (novos.length) falhas.push(`--- tsc --noEmit (erros novos em relação à baseline) ---\n${novos.slice(0, 20).join('\n')}`);
        }
      }
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

function gravaBaseline(p, erros) {
  try {
    fs.mkdirSync('.fableux/cache', { recursive: true });
    fs.writeFileSync(p, JSON.stringify(erros));
  } catch { /* baseline nunca pode quebrar o hook */ }
}
