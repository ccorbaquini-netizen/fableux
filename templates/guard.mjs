// Fableux guard — hook PreToolUse que TORNA DETERMINÍSTICA a economia de leitura:
// bloqueia Read integral de arquivo grande (sem offset/limit) e leitura de lixo.
// Saída 2 = bloqueia e devolve a instrução ao modelo; 0 = permite.

import fs from 'node:fs';

const LIMITE_LINHAS = 350;
const LIXO = /node_modules|[\\/]dist[\\/]|[\\/]build[\\/]|package-lock\.json|yarn\.lock|pnpm-lock|\.min\.(js|css)$|\.map$/;

let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { process.exit(0); }
  if (data.tool_name !== 'Read') process.exit(0);

  const p = data.tool_input?.file_path || '';
  if (LIXO.test(p)) {
    console.error(`Fableux guard: "${p}" é artefato/lixo — não leia; use grep se precisar de algo específico.`);
    process.exit(2);
  }
  if (data.tool_input?.limit || data.tool_input?.offset) process.exit(0);
  try {
    const linhas = fs.readFileSync(p, 'utf8').split('\n').length;
    if (linhas > LIMITE_LINHAS) {
      console.error(`Fableux guard: "${p}" tem ${linhas} linhas. Leia por intervalo (offset/limit) — localize antes com grep. Releia integral só se realmente for editar o arquivo inteiro.`);
      process.exit(2);
    }
  } catch { /* arquivo inexistente/binário: deixa o Read falhar sozinho */ }
  process.exit(0);
});
