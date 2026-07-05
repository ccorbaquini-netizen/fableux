#!/usr/bin/env node
// Fableux autoteste — roda a bateria completa dos hooks contra fixtures
// sintéticas, numa sandbox isolada (não toca o cache do projeto real).
// Uso: node .fableux/autoteste.mjs — sai com código 1 se qualquer caso falhar.
// Rode após atualizar o Claude Code: os hooks dependem do formato interno do
// transcript (compact_boundary, tool_use), que não é API pública.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'fableux-teste-'));
fs.mkdirSync(path.join(SANDBOX, '.fableux'), { recursive: true });
fs.mkdirSync(path.join(SANDBOX, 'fixtures'), { recursive: true });
for (const s of ['guard.mjs', 'digest.mjs', 'statusline.mjs', 'permcount.mjs', 'verificar.mjs']) {
  fs.copyFileSync(path.join(AQUI, s), path.join(SANDBOX, '.fableux', s));
}
process.chdir(SANDBOX);

const casos = [];
let ultimo = null;
function ok(nome, cond) {
  casos.push({ nome, passou: !!cond, detalhe: cond ? '' : (ultimo ? `exit=${ultimo.code} err=${(ultimo.err || '').replace(/\n/g, ' ').slice(0, 160)}` : '') });
}
function roda(script, entrada, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  // variáveis do ambiente do usuário não podem contaminar os casos
  if (!('FABLEUX_OFF' in extraEnv)) delete env.FABLEUX_OFF;
  if (!('FABLEUX_LIMITE' in extraEnv)) delete env.FABLEUX_LIMITE;
  delete env.COLUMNS;
  const r = spawnSync(process.execPath, [path.join('.fableux', script)], {
    input: JSON.stringify(entrada), timeout: 30000, env, encoding: 'utf8',
  });
  ultimo = { code: r.status, out: r.stdout || '', err: r.stderr || '' };
  return ultimo;
}
const semCor = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
const leRead = (arquivo, o = {}) => ({ tool_name: 'Read', session_id: o.sid || 's1', transcript_path: o.t || '', tool_input: { file_path: arquivo, ...(o.input || {}) } });

// ---------- fixtures ----------
const PEQ = path.join('fixtures', 'peq.js');
fs.writeFileSync(PEQ, Array.from({ length: 30 }, (_, i) => `const a${i} = ${i};`).join('\n') + '\n');
const GRANDE = path.join('fixtures', 'grande.js');
{
  const l = [];
  for (let i = 1; i <= 150; i++) l.push(`function fn${i}(a) {`, `  return a + ${i};`, '}', '', '');
  fs.writeFileSync(GRANDE, l.join('\n') + '\n'); // 750 linhas, 150 funções
}
const PRIO = path.join('fixtures', 'prioridade.js');
{
  const l = [];
  for (let i = 1; i <= 200; i++) l.push(`const enchimento${i} = ${i};`);
  for (let i = 1; i <= 160; i++) l.push(`function util${i}(x) {`, `  return x * ${i};`, '}', '');
  fs.writeFileSync(PRIO, l.join('\n') + '\n'); // 360 entradas > teto de 150
}
fs.writeFileSync(path.join('fixtures', 'dados.json'), JSON.stringify({ nome: 'x', itens: [1, 2, 3], cfg: {} }));
fs.writeFileSync(path.join('fixtures', 'package-lock.json'), '{"lockfileVersion":3}\n');
fs.writeFileSync(path.join('fixtures', 'quebrado.mjs'), 'export function x(a, b {\n  return a + b;\n}\n');
fs.writeFileSync(path.join('fixtures', 'valido.mjs'), 'export function x(a, b) {\n  return a + b;\n}\n');

// ---------- guard ----------
let r = roda('guard.mjs', leRead(path.join('fixtures', 'package-lock.json')));
ok('guard: bloqueia lockfile', r.code === 2 && /artefato|lixo/.test(r.err));
r = roda('guard.mjs', leRead(path.join('fixtures', 'nao-existe', 'yarn.lock')));
ok('guard: bloqueia lockfile inexistente', r.code === 2);
r = roda('guard.mjs', leRead(GRANDE));
const digestMsg = (r.err.match(/"([^"]+\.md)"/) || [])[1];
ok('guard: bloqueia arquivo grande', r.code === 2 && /751 linhas/.test(r.err));
ok('guard: digest gerado no bloqueio', digestMsg && fs.existsSync(digestMsg));
r = roda('guard.mjs', leRead(GRANDE, { input: { offset: 10, limit: 20 } }));
ok('guard: permite leitura por intervalo', r.code === 0);

const T = 't.jsonl';
fs.writeFileSync(T, '');
r = roda('guard.mjs', leRead(PEQ, { sid: 'rel', t: T }));
ok('guard: 1ª leitura integral registra e passa', r.code === 0);
r = roda('guard.mjs', leRead(PEQ, { sid: 'rel', t: T }));
ok('guard: releitura sem mudança bloqueia', r.code === 2 && /já leu/.test(r.err));
// conteúdo de arquivo entra no transcript com aspas escapadas — não pode liberar
fs.appendFileSync(T, '{"type":"tool_result","content":"cita \\"subtype\\":\\"compact_boundary\\" e \\"isCompactSummary\\":true em texto"}\n');
r = roda('guard.mjs', leRead(PEQ, { sid: 'rel', t: T }));
ok('guard: citação escapada não libera releitura (regressão)', r.code === 2);
fs.appendFileSync(T, '{"type":"system","subtype":"compact_boundary"}\n');
r = roda('guard.mjs', leRead(PEQ, { sid: 'rel', t: T }));
ok('guard: compact_boundary real libera a releitura', r.code === 0);
r = roda('guard.mjs', leRead(PEQ, { sid: 'rel', t: T }));
ok('guard: após reler, volta a bloquear', r.code === 2);
fs.appendFileSync(T, '{"isCompactSummary":true}\n');
r = roda('guard.mjs', leRead(PEQ, { sid: 'rel', t: T }));
ok('guard: isCompactSummary também libera', r.code === 0);

r = roda('guard.mjs', leRead(PEQ, { sid: 'lim' }), { FABLEUX_LIMITE: '10' });
ok('guard: FABLEUX_LIMITE ajusta o limiar', r.code === 2);
r = roda('guard.mjs', leRead(GRANDE, { sid: 'off1' }), { FABLEUX_OFF: '1' });
ok('guard: FABLEUX_OFF desativa', r.code === 0);
fs.writeFileSync(path.join('.fableux', 'off'), '');
r = roda('guard.mjs', leRead(GRANDE, { sid: 'off2' }));
ok('guard: arquivo .fableux/off desativa', r.code === 0);
fs.rmSync(path.join('.fableux', 'off'));

const eco = fs.readFileSync(path.join('.fableux', 'cache', 'economia.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
ok('guard: economia registra lixo/grande/releitura', ['lixo', 'grande', 'releitura'].every((t) => eco.some((e) => e.tipo === t)));
ok('guard: lixo sem stat loga com tok 0', eco.some((e) => e.tipo === 'lixo' && e.tok === 0));

// ---------- digest ----------
const { digestFor } = await import(pathToFileURL(path.join(SANDBOX, '.fableux', 'digest.mjs')).href);
const dGrande = digestFor(GRANDE);
const digGrande = fs.readFileSync(dGrande.cachePath, 'utf8');
{
  const mapa = new Map();
  for (const dl of digGrande.split('\n')) {
    const m = dl.match(/^L(\d+): (.*)$/);
    if (m) mapa.set(Number(m[1]), m[2]);
  }
  let exatas = 0;
  fs.readFileSync(GRANDE, 'utf8').split('\n').forEach((l, i) => {
    const m = l.match(/^function (\w+)/);
    if (m && (mapa.get(i + 1) || '').includes(`function ${m[1]}(`)) exatas++;
  });
  ok('digest: 150/150 funções com linha exata', exatas === 150);
}
fs.appendFileSync(dGrande.cachePath, 'MARCA-DE-CACHE\n');
digestFor(GRANDE);
ok('digest: cache reaproveitado quando a fonte não mudou', fs.readFileSync(dGrande.cachePath, 'utf8').includes('MARCA-DE-CACHE'));
const dPrio = digestFor(PRIO);
const digPrio = fs.readFileSync(dPrio.cachePath, 'utf8');
ok('digest: teto prioriza funções sobre const', !digPrio.includes('enchimento') && digPrio.includes('function util1(') && /210 entradas omitidas \(imports\/const primeiro\)/.test(digPrio));
const digJson = fs.readFileSync(digestFor(path.join('fixtures', 'dados.json')).cachePath, 'utf8');
ok('digest: JSON vira chaves + tipos', digJson.includes('nome: string') && digJson.includes('itens: array[3]') && digJson.includes('cfg: object'));

// ---------- verificar ----------
r = roda('verificar.mjs', { session_id: 'v0', transcript_path: 'transcript-inexistente.jsonl' });
ok('verificar: sem transcript não atrapalha', r.code === 0);
const edicao = (fp) => JSON.stringify({ type: 'a', message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: path.resolve(fp) } }] } }) + '\n';
fs.writeFileSync('tv.jsonl', edicao(path.join('fixtures', 'quebrado.mjs')));
const pv = { session_id: 'vt', transcript_path: 'tv.jsonl' };
r = roda('verificar.mjs', pv);
ok('verificar: bloqueia com erro verbatim (1/2)', r.code === 2 && /SyntaxError/.test(r.err) && /1\/2/.test(r.err));
r = roda('verificar.mjs', pv);
ok('verificar: 2ª tentativa ainda bloqueia (2/2)', r.code === 2 && /2\/2/.test(r.err));
r = roda('verificar.mjs', pv);
ok('verificar: teto de 2 solta o turno na 3ª', r.code === 0);
ok('verificar: contador limpo após o teto', !fs.readFileSync(path.join('.fableux', 'cache', 'verificacoes.json'), 'utf8').includes('vt'));
fs.writeFileSync('tv.jsonl', edicao(path.join('fixtures', 'valido.mjs')));
r = roda('verificar.mjs', { session_id: 'vv', transcript_path: 'tv.jsonl' });
ok('verificar: arquivo válido encerra normal', r.code === 0);

// ---------- verificar + TypeScript (tsc do projeto simulado por stub) ----------
// O stub grava um marcador quando invocado e devolve o conteúdo de tsc-saida.txt,
// permitindo testar a lógica de baseline sem depender do pacote typescript.
fs.mkdirSync(path.join('node_modules', 'typescript', 'lib'), { recursive: true });
fs.writeFileSync(path.join('node_modules', 'typescript', 'lib', 'tsc.js'),
  "const fs=require('fs');fs.writeFileSync('tsc-chamado.txt','1');let o='';try{o=fs.readFileSync('tsc-saida.txt','utf8')}catch{}process.stdout.write(o);process.exit(o.trim()?2:0);\n");
fs.writeFileSync(path.join('fixtures', 'app.ts'), 'export const x: number = 1;\n');
fs.writeFileSync('tt.jsonl', edicao(path.join('fixtures', 'app.ts')));
fs.writeFileSync('tsc-saida.txt', 'fixtures/app.ts(1,1): error TS1111: antigo um.\n');

r = roda('verificar.mjs', { session_id: 'ts0', transcript_path: 'tt.jsonl' });
ok('verificar/ts: sem tsconfig fica inerte', r.code === 0 && !fs.existsSync('tsc-chamado.txt'));
fs.writeFileSync('tsconfig.json', '{"compilerOptions":{"strict":true}}');
r = roda('verificar.mjs', { session_id: 'vv2', transcript_path: 'tv.jsonl' });
ok('verificar/ts: turno só-JS não invoca o tsc', r.code === 0 && !fs.existsSync('tsc-chamado.txt'));

fs.writeFileSync('tsc-saida.txt', 'fixtures/app.ts(1,1): error TS1111: antigo um.\nfixtures/app.ts(2,1): error TS2222: antigo dois.\n');
const baseTs = () => JSON.parse(fs.readFileSync(path.join('.fableux', 'cache', 'ts-baseline.json'), 'utf8'));
r = roda('verificar.mjs', { session_id: 'ts1', transcript_path: 'tt.jsonl' });
ok('verificar/ts: 1ª rodada cria baseline sem bloquear', r.code === 0 && baseTs().length === 2 && fs.existsSync('tsc-chamado.txt'));
r = roda('verificar.mjs', { session_id: 'ts2', transcript_path: 'tt.jsonl' });
ok('verificar/ts: erros pré-existentes não bloqueiam', r.code === 0);
fs.appendFileSync('tsc-saida.txt', 'fixtures/app.ts(9,9): error TS3333: novinho.\n');
r = roda('verificar.mjs', { session_id: 'ts3', transcript_path: 'tt.jsonl' });
ok('verificar/ts: erro novo bloqueia e cita só ele', r.code === 2 && /TS3333/.test(r.err) && !/TS1111/.test(r.err));
r = roda('verificar.mjs', { session_id: 'ts3', transcript_path: 'tt.jsonl' });
ok('verificar/ts: teto vale também para TS (2/2)', r.code === 2 && /2\/2/.test(r.err));
r = roda('verificar.mjs', { session_id: 'ts3', transcript_path: 'tt.jsonl' });
ok('verificar/ts: 3ª tentativa solta o turno', r.code === 0);
fs.writeFileSync('tsc-saida.txt', 'fixtures/app.ts(2,1): error TS2222: antigo dois.\n');
r = roda('verificar.mjs', { session_id: 'ts4', transcript_path: 'tt.jsonl' });
ok('verificar/ts: baseline encolhe quando erro some', r.code === 0 && baseTs().length === 1);
fs.writeFileSync('tsc-saida.txt', 'fixtures/app.ts(1,1): error TS1111: antigo um.\nfixtures/app.ts(2,1): error TS2222: antigo dois.\n');
r = roda('verificar.mjs', { session_id: 'ts5', transcript_path: 'tt.jsonl' });
ok('verificar/ts: erro corrigido que voltou bloqueia', r.code === 2 && /TS1111/.test(r.err));

// ---------- permcount ----------
r = roda('permcount.mjs', { session_id: 'p1', message: 'Claude is waiting for your input' });
const permAntes = fs.existsSync(path.join('.fableux', 'cache', 'permissoes.jsonl')) ? fs.readFileSync(path.join('.fableux', 'cache', 'permissoes.jsonl'), 'utf8') : '';
ok('permcount: notificação sem "permiss" não conta', r.code === 0 && !permAntes.includes('p1'));
r = roda('permcount.mjs', { session_id: 'p1', message: 'Claude needs your permission to use Bash' });
ok('permcount: pedido de permissão conta', fs.readFileSync(path.join('.fableux', 'cache', 'permissoes.jsonl'), 'utf8').split('\n').filter((l) => l.includes('p1')).length === 1);

// ---------- statusline ----------
const modelo = { display_name: 'Fable 5', id: 'claude-fable-5' };
r = roda('statusline.mjs', { session_id: 's', model: modelo, cost: { total_cost_usd: 1.23 }, context_window: { used_percentage: 42, context_window_size: 200000, total_input_tokens: 80000, total_output_tokens: 0 } });
let saida = semCor(r.out);
ok('statusline: telemetria básica', saida.includes('Fable 5') && saida.includes('contexto 42%') && saida.includes('$1.23'));
r = roda('statusline.mjs', { session_id: 's', model: modelo, context_window: { used_percentage: 85, context_window_size: 200000, total_input_tokens: 168000, total_output_tokens: 0 } });
ok('statusline: aviso urgente de contexto', /\/compact/.test(semCor(r.out)) && /AGORA/.test(semCor(r.out)));
fs.writeFileSync(path.join('.fableux', 'off'), '');
r = roda('statusline.mjs', { session_id: 's', model: modelo });
ok('statusline: indica Fableux pausado', /pausado/.test(semCor(r.out)));
fs.rmSync(path.join('.fableux', 'off'));

// rotação do log: > 1MB compacta em saldo + linhas da sessão atual
const LOG = path.join('.fableux', 'cache', 'economia.jsonl');
{
  const velhas = [];
  for (let i = 0; i < 9000; i++) velhas.push(JSON.stringify({ t: '2026-01-01T00:00:00Z', sid: 'antiga' + (i % 7), arquivo: 'x'.repeat(60), tipo: i % 2 ? 'lixo' : 'grande', linhas: 700, tok: 100 }));
  velhas.push(JSON.stringify({ t: '2026-01-02T00:00:00Z', sid: 'atual', arquivo: 'a.js', tipo: 'releitura', tok: 50 }));
  velhas.push(JSON.stringify({ t: '2026-01-02T00:00:01Z', sid: 'atual', arquivo: 'b.js', tipo: 'grande', tok: 70 }));
  fs.writeFileSync(LOG, velhas.join('\n') + '\n');
}
r = roda('statusline.mjs', { session_id: 'atual', model: modelo });
saida = semCor(r.out);
ok('statusline: totais corretos no prompt que rotaciona', saida.includes('poupou 120') && saida.includes('900.1k total'));
const depois = fs.readFileSync(LOG, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const saldos = depois.filter((e) => e.tipo === 'saldo');
ok('rotação: log encolhe para saldos por tipo + sessão atual', depois.length === 4 && saldos.length === 2 && ['grande', 'lixo'].every((t) => saldos.some((s) => s.de === t && s.tok === 450000 && s.n === 4500)));
r = roda('statusline.mjs', { session_id: 'atual', model: modelo });
ok('rotação: totais idênticos após compactar', semCor(r.out).includes('poupou 120') && semCor(r.out).includes('900.1k total'));

// ---------- cli.js stats (roda só a partir do repo, onde cli.js existe) ----------
const CLI = path.join(AQUI, '..', 'cli.js');
if (fs.existsSync(CLI)) {
  const rs = spawnSync(process.execPath, [CLI, 'stats'], { cwd: SANDBOX, encoding: 'utf8', timeout: 30000 });
  ultimo = { code: rs.status, out: rs.stdout || '', err: rs.stderr || '' };
  const so = semCor(rs.stdout || '');
  ok('stats: total, tipos e top arquivos', rs.status === 0 && so.includes('900.1k') && so.includes('grande') && so.includes('b.js'));
}

// ---------- resultado ----------
process.chdir(os.tmpdir());
try { fs.rmSync(SANDBOX, { recursive: true, force: true }); } catch { /* sandbox em uso: o SO limpa */ }
let falhas = 0;
for (const c of casos) {
  if (!c.passou) falhas++;
  console.log(`${c.passou ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${c.nome}${c.passou || !c.detalhe ? '' : `\n    ${c.detalhe}`}`);
}
console.log(`\n${casos.length - falhas}/${casos.length} casos passaram (node ${process.version}, ${process.platform})`);
process.exit(falhas ? 1 : 0);
