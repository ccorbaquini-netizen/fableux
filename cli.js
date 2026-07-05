#!/usr/bin/env node
// Fableux — instala o copiloto de UI/UX no projeto atual.
// Zero dependências. Convive com Ruflo/claude-flow: nunca sobrescreve nada
// que não seja seu (seção demarcada no CLAUDE.md, arquivos namespaceados).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TPL = path.join(HERE, 'templates');
const CWD = process.cwd();

const START = '<!-- fableux:start -->';
const END = '<!-- fableux:end -->';

const copies = [
  // [origem em templates/, destino no projeto]
  ['agents/fableux-designer.md', '.claude/agents/fableux-designer.md'],
  ['commands/ux-review.md', '.claude/commands/ux-review.md'],
  ['commands/ux-polish.md', '.claude/commands/ux-polish.md'],
  ['commands/ux-mobile.md', '.claude/commands/ux-mobile.md'],
  ['kb/index.md', '.fableux/kb/index.md'],
  ['kb/effects.md', '.fableux/kb/effects.md'],
  ['kb/motion.md', '.fableux/kb/motion.md'],
  ['kb/mobile.md', '.fableux/kb/mobile.md'],
  ['kb/checklist.md', '.fableux/kb/checklist.md'],
  ['kb/profile.md', '.fableux/kb/profile.md'],
  ['guard.mjs', '.fableux/guard.mjs'],
  ['digest.mjs', '.fableux/digest.mjs'],
  ['statusline.mjs', '.fableux/statusline.mjs'],
  ['permcount.mjs', '.fableux/permcount.mjs'],
];

const GUARD_CMD = 'node .fableux/guard.mjs';
const STATUS_CMD = 'node .fableux/statusline.mjs';
const PERM_CMD = 'node .fableux/permcount.mjs';

// instala o hook de guarda em .claude/settings.local.json (merge seguro, idempotente)
function mergeGuardHook() {
  const p = path.join(CWD, '.claude', 'settings.local.json');
  let cfg = {};
  if (fs.existsSync(p)) {
    try { cfg = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { cfg = {}; }
  }
  cfg.hooks = cfg.hooks || {};
  cfg.hooks.PreToolUse = cfg.hooks.PreToolUse || [];
  const jaTem = JSON.stringify(cfg.hooks.PreToolUse).includes('fableux/guard');
  if (!jaTem) {
    cfg.hooks.PreToolUse.push({
      matcher: 'Read',
      hooks: [{ type: 'command', command: GUARD_CMD }],
    });
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
    console.log('  + .claude/settings.local.json (hook de guarda de leitura — determinístico)');
  } else {
    console.log('  ~ .claude/settings.local.json (hook de guarda já presente)');
  }
}

// statusline com economia em tempo real — só instala se o projeto não tiver uma própria
function mergeStatusLine() {
  const p = path.join(CWD, '.claude', 'settings.local.json');
  let cfg = {};
  if (fs.existsSync(p)) {
    try { cfg = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { cfg = {}; }
  }
  if (!cfg.statusLine) {
    cfg.statusLine = { type: 'command', command: STATUS_CMD };
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
    console.log('  + statusLine (economia de tokens em tempo real no prompt)');
  } else if (!/fableux/.test(cfg.statusLine.command || '')) {
    console.log('  ! statusLine própria do projeto mantida — troque para "' + STATUS_CMD + '" se quiser a do Fableux');
  } else {
    console.log('  ~ statusLine do Fableux já presente');
  }
}

// contador de pedidos de permissão (alimenta a sugestão de /fewer-permission-prompts)
function mergePermHook() {
  const p = path.join(CWD, '.claude', 'settings.local.json');
  let cfg = {};
  if (fs.existsSync(p)) {
    try { cfg = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { cfg = {}; }
  }
  cfg.hooks = cfg.hooks || {};
  cfg.hooks.Notification = cfg.hooks.Notification || [];
  if (!JSON.stringify(cfg.hooks.Notification).includes('fableux/permcount')) {
    cfg.hooks.Notification.push({ hooks: [{ type: 'command', command: PERM_CMD }] });
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
    console.log('  + hook Notification (contador de pedidos de permissão)');
  } else {
    console.log('  ~ hook Notification já presente');
  }
}

function removeGuardHook() {
  const p = path.join(CWD, '.claude', 'settings.local.json');
  if (!fs.existsSync(p)) return;
  try {
    const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (cfg.hooks?.PreToolUse) {
      cfg.hooks.PreToolUse = cfg.hooks.PreToolUse.filter(
        (h) => !JSON.stringify(h).includes('fableux/guard')
      );
      if (cfg.hooks.PreToolUse.length === 0) delete cfg.hooks.PreToolUse;
      if (cfg.hooks.Notification) {
        cfg.hooks.Notification = cfg.hooks.Notification.filter((h) => !JSON.stringify(h).includes('fableux/permcount'));
        if (cfg.hooks.Notification.length === 0) delete cfg.hooks.Notification;
      }
      if (Object.keys(cfg.hooks).length === 0) delete cfg.hooks;
      if (/fableux/.test(cfg.statusLine?.command || '')) delete cfg.statusLine;
      if (Object.keys(cfg).length === 0) fs.rmSync(p);
      else fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
      console.log('  - hook de guarda e statusline removidos (resto do settings.local.json intacto)');
    }
  } catch { /* settings ilegível: não toca */ }
}

function mergeClaudeMd() {
  const section = fs.readFileSync(path.join(TPL, 'claude-section.md'), 'utf8').trim();
  const target = path.join(CWD, 'CLAUDE.md');
  let out;
  if (fs.existsSync(target)) {
    const cur = fs.readFileSync(target, 'utf8');
    if (cur.includes(START) && cur.includes(END)) {
      // atualização idempotente: substitui só a nossa seção
      out = cur.replace(new RegExp(`${START}[\\s\\S]*?${END}`), section);
      console.log('  ~ CLAUDE.md (seção Fableux atualizada, resto intacto)');
    } else {
      out = cur.trimEnd() + '\n\n' + section + '\n';
      console.log('  + CLAUDE.md (seção Fableux adicionada ao final — Ruflo intacto)');
    }
  } else {
    out = section + '\n';
    console.log('  + CLAUDE.md (criado)');
  }
  fs.writeFileSync(target, out);
}

function init() {
  console.log('\nFableux — instalando no projeto:\n');
  for (const [src, dst] of copies) {
    const to = path.join(CWD, dst);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    const existed = fs.existsSync(to);
    fs.copyFileSync(path.join(TPL, src), to);
    console.log(`  ${existed ? '~' : '+'} ${dst}`);
  }
  mergeClaudeMd();
  if (!process.argv.includes('--no-guard')) { mergeGuardHook(); mergeStatusLine(); mergePermHook(); }
  console.log(`\nPronto. Abra o Claude Code neste projeto e use:
  /ux-review   auditoria de UI/UX (só diagnóstico)
  /ux-polish   aplicar movimento e efeitos
  /ux-mobile   caça aos bugs clássicos de mobile

Guarda de leitura: arquivos > 600 linhas geram digest em .fableux/cache/
(mapa estrutural que substitui a leitura integral). Cada bloqueio é logado
em .fableux/cache/economia.jsonl e a statusline mostra o total poupado.
  desligar p/ revisão profunda:  crie o arquivo .fableux/off (efeito imediato)
  religar:                       apague .fableux/off
  limiar por sessão:             variável FABLEUX_LIMITE (padrão 600)\n`);
}

function remove() {
  removeGuardHook();
  for (const [, dst] of copies) {
    const p = path.join(CWD, dst);
    if (fs.existsSync(p)) { fs.rmSync(p); console.log(`  - ${dst}`); }
  }
  for (const extra of ['.fableux/cache', '.fableux/off']) {
    const p = path.join(CWD, extra);
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true });
  }
  for (const dir of ['.fableux/kb', '.fableux']) {
    const p = path.join(CWD, dir);
    if (fs.existsSync(p) && fs.readdirSync(p).length === 0) fs.rmdirSync(p);
  }
  const target = path.join(CWD, 'CLAUDE.md');
  if (fs.existsSync(target)) {
    const cur = fs.readFileSync(target, 'utf8');
    if (cur.includes(START)) {
      const out = cur.replace(new RegExp(`\\n*${START}[\\s\\S]*?${END}\\n*`), '\n').trim();
      if (out) fs.writeFileSync(target, out + '\n');
      else fs.rmSync(target);
      console.log('  - seção Fableux removida do CLAUDE.md (resto intacto)');
    }
  }
  console.log('Fableux removido.');
}

const cmd = process.argv[2];
if (cmd === 'init' || cmd === 'update') init();
else if (cmd === 'remove') remove();
else console.log(`Fableux — copiloto de UI/UX para Claude Code

Uso:
  npx github:ccorbaquini-netizen/fableux init     instala/atualiza no projeto atual
  npx github:ccorbaquini-netizen/fableux remove   desinstala (preserva o resto do CLAUDE.md)`);
