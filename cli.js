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
];

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
  console.log(`\nPronto. Abra o Claude Code neste projeto e use:
  /ux-review   auditoria de UI/UX (só diagnóstico)
  /ux-polish   aplicar movimento e efeitos
  /ux-mobile   caça aos bugs clássicos de mobile

O perfil Fable e a economia de tokens valem para TODA a sessão.
Base de conhecimento (carregada só sob demanda): .fableux/kb/\n`);
}

function remove() {
  for (const [, dst] of copies) {
    const p = path.join(CWD, dst);
    if (fs.existsSync(p)) { fs.rmSync(p); console.log(`  - ${dst}`); }
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
