# Fableux

Copiloto de **UI/UX** para Claude Code com **perfil Fable 5** e **economia máxima de tokens**.
Instala na pasta de qualquer projeto e convive em paralelo com Ruflo/claude-flow — nunca sobrescreve nada que não seja seu.

## Instalação

```bash
cd meu-projeto
npx --yes github:ccorbaquini-netizen/fableux init
```

Atualizar: rode `init` de novo (idempotente). Remover: `npx --yes github:ccorbaquini-netizen/fableux remove` — apaga só a seção demarcada do CLAUDE.md e os arquivos do Fableux, preservando Ruflo e tudo mais.

## O que ele instala

| Arquivo | Papel |
|---|---|
| `CLAUDE.md` (seção demarcada) | Perfil Fable + regras de economia de tokens + defaults de UI/UX — **~35 linhas**, o único conteúdo sempre carregado |
| `.claude/commands/ux-review.md` | `/ux-review` — auditoria de UI/UX (só diagnóstico, ranqueado por impacto) |
| `.claude/commands/ux-polish.md` | `/ux-polish` — aplica movimento (Motion vanilla) e efeitos estilo 21st.dev |
| `.claude/commands/ux-mobile.md` | `/ux-mobile` — caça os 9 bugs clássicos de mobile (zoom, font boosting, safe-area...) |
| `.claude/agents/fableux-designer.md` | Agente especialista delegável |
| `.fableux/kb/*.md` | Base de conhecimento (receitas de efeitos, Motion, mobile, checklists) — **carregada só sob demanda** |
| `.fableux/guard.mjs` | Hook PreToolUse: bloqueia leitura integral de arquivo > 600 linhas e de artefatos (lockfiles, `dist/`) |
| `.fableux/digest.mjs` | Gera o **digest** (mapa estrutural com nº de linha) do arquivo bloqueado, em `.fableux/cache/` |
| `.fableux/statusline.mjs` | Statusline do Claude Code com a **economia de tokens em tempo real** (sessão e total) |
| `.fableux/verificar.mjs` | Hook Stop: `node --check` nos .js editados + `tsc --noEmit` com baseline nos .ts (bloqueia só erro **novo**; máx. 2 voltas) |
| `.fableux/autoteste.mjs` | Bateria de autoteste dos hooks (44 casos, sandbox isolada) — roda no CI em Linux e Windows |

## Como economiza tokens

A maior economia vem da arquitetura, não de instruções:

1. **Pegada fixa mínima** — só ~35 linhas entram em toda sessão; o conhecimento profundo fica em `.fableux/kb/` e o modelo abre **um único arquivo** quando (e se) a tarefa pede.
2. **Guarda determinística + digest** — o hook bloqueia Read integral de arquivo grande e entrega no lugar um mapa estrutural (assinaturas + nº de linha, gerado por regex — nunca resumo de LLM, logo sem alucinação). O modelo lê ~60 linhas em vez de milhares e vai direto ao trecho certo com offset/limit. Economia típica de 75–90% por acesso a arquivo grande.
3. **Regras duras de leitura** — grep antes de ler, leitura por intervalo de linhas, nunca reler arquivo inalterado, citar `arquivo:linha` em vez de colar código.
4. **Sem subagentes espontâneos** — cada spawn re-deriva contexto que a sessão já tem.
5. **Respostas enxutas** — resultado primeiro, sem re-narrar plano, sem colar arquivos.

## Medição e controle

- **Log de economia**: cada bloqueio grava tokens poupados (estimados) em `.fableux/cache/economia.jsonl`.
- **Statusline**: linha fixa no prompt — `⚡ Fableux | Fable 5 | poupado ~12k tok na sessão (4) · ~85k total (31) | $0.42` — custo zero de tokens (é só UI).
- **Interruptor**: crie o arquivo `.fableux/off` para desligar a guarda (efeito imediato, ideal para refatoração ampla/auditoria que exige leitura integral); apague para religar. A statusline indica `⏸ guard OFF`. Alternativas: `FABLEUX_OFF=1` (sessão inteira) e `FABLEUX_LIMITE=N` (muda o limiar de 600 linhas).
- **Autoteste**: `node .fableux/autoteste.mjs` roda a bateria completa dos hooks em sandbox. Rode após atualizar o Claude Code — os hooks dependem do formato interno do transcript, que não é API pública.
- **Estatísticas**: `npx --yes github:ccorbaquini-netizen/fableux stats` resume a economia do projeto — total, por tipo, últimos dias e top arquivos bloqueados (bloqueio recorrente = candidato a dividir o arquivo).

## Benchmark (v1.4.2)

Medido em benchmark A/B: projeto sintético de 6,9k linhas duplicado em dois braços idênticos (com e sem Fableux), três camadas — simulação determinística com os hooks reais, métricas de qualidade isoladas e execuções reais `claude -p` (Haiku) com a mesma tarefa nos dois braços.

| Métrica | Sem Fableux | Com Fableux |
|---|---|---|
| Tokens em 4 fluxos típicos de leitura (simulado) | 42.170 | **4.702 (−89%)** |
| Custo real E2E, 2 tarefas idênticas | $0,1460 | **$0,0666 (−54%)** |
| Tokens novos em cache no E2E | 63.142 | **18.025 (−71%)** |
| Respostas corretas no E2E | 2/2 | 2/2 |

- **Digest**: 99,7% das funções (346/347) mapeadas com número de linha exato; zero linhas erradas.
- **Verificar (hook Stop)**: 3/3 erros de sintaxe capturados antes da entrega, zero falso positivo; bug semântico não é pego (`node --check` não é linter).
- **Custo do mecanismo**: ~300 ms por Read (startup do Node no Windows) e 1–2 turnos a mais quando há bloqueio (~2× o tempo de parede da tarefa no E2E) — troca-se tempo por tokens. Onde não há arquivo grande, releitura nem artefato, nada muda.

O braço "com" contabiliza tudo que a ferramenta custa (mensagem de bloqueio, digest completo e a leitura dirigida que ainda acontece). O efeito real tende a ser maior: cada token que entra no contexto é reenviado em todos os turnos seguintes da sessão.

## Perfil Fable 5

O Fableux faz o modelo operar como o Fable: **verificar antes de afirmar** (rodar o app/testes e ler a saída real), reportar falhas na íntegra e em primeiro lugar, separar explicitamente o que foi testado do que não foi, mudanças pequenas e reversíveis no estilo do código existente, e parar no diagnóstico quando o usuário descreveu um problema sem pedir correção. A matriz de validação por tipo de mudança está em `.fableux/kb/profile.md`.

## Especialidade UI/UX

- **Motion** (motor vanilla do framer-motion, via CDN — zero build): springs, stagger, scroll-reveal, contadores, anéis de progresso, tilt 3D
- **Efeitos estilo 21st.dev** em CSS puro: aurora, spotlight, shimmer, glow-border (técnica que funciona no mobile), marquee, text-sheen
- **Mobile hard rules**: as 9 regras que evitam os bugs reais mais comuns (auto-zoom por input < 16px, font boosting do Chrome Android, touch-action, theme-color, safe-area, overflow)
- Sempre com `prefers-reduced-motion` e acessibilidade no checklist

## Convivência com Ruflo

- A seção no `CLAUDE.md` fica entre os marcadores `<!-- fableux:start/end -->` — o `init` atualiza só esse trecho e o `remove` apaga só ele.
- Todos os arquivos são namespaceados (`fableux-*`, `.fableux/`, `ux-*`) — nenhuma colisão com os comandos/agentes do Ruflo.
- Um único hook (PreToolUse em Read, o guard) e uma statusline, ambos processos Node instantâneos e sem daemon; o `remove` desfaz os dois preservando o resto do settings. Instale sem o hook com `init --no-guard`.

## Licença

MIT
