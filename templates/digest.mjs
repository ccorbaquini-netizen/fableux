// Fableux digest — gera um "mapa estrutural" de arquivo grande em .fableux/cache/.
// O digest lista declarações/headings com número de linha para o modelo ler ~60
// linhas em vez de milhares, e então fazer Read por intervalo (offset/limit).
// Cache por caminho relativo, invalidado por mtime. A pasta se autocria — todo
// projeto que receber .fableux/ ganha o cache sem passo de instalação extra.
// Uso CLI: node .fableux/digest.mjs <arquivo>

import fs from 'node:fs';
import path from 'node:path';

const CACHE_DIR = path.join('.fableux', 'cache');
const MAX_LINHAS_DIGEST = 150;
const MAX_LARGURA = 120;

const REGRAS = [
  // Declarações só em coluna 0 (const/let indentado é corpo de função, não estrutura);
  // métodos indentados aceitos, exceto keywords de controle que imitam chamada.
  { ext: /\.(mjs|cjs|jsx?|tsx?)$/, re: /^(import\b|export\b|(async\s+)?function\b|class\b|const\b|let\b|var\b|interface\b|type\b|enum\b|module\.exports)|^\s{2,4}(?!if\b|for\b|while\b|switch\b|catch\b|return\b)((async\s+)?[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{|(public|private|protected|static)\b)/ },
  { ext: /\.py$/, re: /^(import\b|from\b|def\b|class\b|if __name__)|^\s{4}(async\s+)?def\b/ },
  { ext: /\.(css|scss|less)$/, re: /^[.#@:\[a-zA-Z][^;{}]*\{|^@(media|keyframes|layer|supports)/ },
  { ext: /\.(html?|vue|svelte)$/, re: /<(section|header|footer|main|nav|aside|form|dialog|template|script|style)\b|id="[^"]+"|<h[1-6]\b/i },
  { ext: /\.(md|mdx)$/, re: /^#{1,6}\s|^```/ },
];

function extrairEsqueleto(caminho, linhas) {
  const regra = REGRAS.find((r) => r.ext.test(caminho));
  const saida = [];
  if (caminho.endsWith('.json')) {
    try {
      const obj = JSON.parse(linhas.join('\n'));
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        const tipo = Array.isArray(v) ? `array[${v.length}]` : typeof v;
        saida.push(`${k}: ${tipo}`);
      }
      return saida;
    } catch { /* JSON inválido: cai no fallback */ }
  }
  const re = regra?.re;
  linhas.forEach((linha, i) => {
    if (re ? re.test(linha) : /^\S/.test(linha)) {
      saida.push(`L${i + 1}: ${linha.trim().slice(0, MAX_LARGURA)}`);
    }
  });
  return saida;
}

// Devolve { cachePath, totalLinhas } gerando/reaproveitando o digest em cache.
export function digestFor(arquivo) {
  const abs = path.resolve(arquivo);
  const stat = fs.statSync(abs);
  const rel = path.relative(process.cwd(), abs) || abs;
  const slug = rel.replace(/[\\/:]+/g, '__');
  const cachePath = path.join(CACHE_DIR, `${slug}.md`);
  const carimbo = `<!-- src:${rel} mtime:${stat.mtimeMs} -->`;

  try {
    const primeira = fs.readFileSync(cachePath, 'utf8').split('\n', 1)[0];
    if (primeira === carimbo) {
      const totalLinhas = fs.readFileSync(abs, 'utf8').split('\n').length;
      return { cachePath, totalLinhas };
    }
  } catch { /* cache ausente/ilegível: gera */ }

  const linhas = fs.readFileSync(abs, 'utf8').split('\n');
  let esqueleto = extrairEsqueleto(rel, linhas);
  let nota = '';
  if (esqueleto.length > MAX_LINHAS_DIGEST) {
    nota = `\n… ${esqueleto.length - MAX_LINHAS_DIGEST} entradas omitidas — use grep para o restante.`;
    esqueleto = esqueleto.slice(0, MAX_LINHAS_DIGEST);
  }
  if (esqueleto.length === 0) esqueleto = linhas.slice(0, 40).map((l, i) => `L${i + 1}: ${l.trim().slice(0, MAX_LARGURA)}`);

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const gitignore = path.join(CACHE_DIR, '.gitignore');
  if (!fs.existsSync(gitignore)) fs.writeFileSync(gitignore, '*\n');

  const corpo = `${carimbo}\n# Digest: ${rel} (${linhas.length} linhas)\nMapa estrutural — leia o trecho real com Read offset/limit nas linhas indicadas.\n\n${esqueleto.join('\n')}${nota}\n`;
  fs.writeFileSync(cachePath, corpo);
  return { cachePath, totalLinhas: linhas.length };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1])) && process.argv[2]) {
  const { cachePath, totalLinhas } = digestFor(process.argv[2]);
  console.log(`${cachePath} (fonte: ${totalLinhas} linhas)`);
}
