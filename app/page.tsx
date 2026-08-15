"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Params = { x0: number; L: number; k: number };
type Snapshot = {
  generation: number;
  population: number[];
  mean: number;
  sd: number;
  p10: number;
  p90: number;
  survival: number;
  gametes: number;
};

const N_POP = 1000;
const ENERGY = 100;
const MUTATION_SD = 0.5;
const MAX_GENERATIONS = 300;
const DEFAULT_PARAMS: Params = { x0: 20, L: 1, k: 0.25 };

function normal(mean = 0, sd = 1) {
  const u = Math.max(Math.random(), Number.EPSILON);
  const v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function survivalProbability(size: number, params: Params) {
  return params.L / (1 + Math.exp(-params.k * (size - params.x0)));
}

function summarize(population: number[], generation = 0, survival = 0, gametes = 0): Snapshot {
  const sorted = [...population].sort((a, b) => a - b);
  const mean = population.reduce((sum, value) => sum + value, 0) / population.length;
  const variance = population.reduce((sum, value) => sum + (value - mean) ** 2, 0) / population.length;
  return {
    generation,
    population,
    mean,
    sd: Math.sqrt(variance),
    p10: sorted[Math.floor(sorted.length * 0.1)],
    p90: sorted[Math.floor(sorted.length * 0.9)],
    survival,
    gametes,
  };
}

function makeInitialPopulation(center: number) {
  let seed = 814725;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const population: number[] = [];
  const maxDeviation = Math.min(center - 1, 100 - center);
  for (let i = 0; i < N_POP / 2; i += 1) {
    const u = Math.max(random(), Number.EPSILON);
    const v = random();
    const deviation = Math.min(
      Math.abs(3 * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)),
      maxDeviation,
    );
    population.push(center - deviation, center + deviation);
  }
  return population;
}

function nextGeneration(current: Snapshot, params: Params): Snapshot | null {
  const gametes: number[] = [];
  for (const size of current.population) {
    const count = Math.round(ENERGY / size);
    for (let j = 0; j < count; j += 1) gametes.push(size);
  }

  for (let i = gametes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [gametes[i], gametes[j]] = [gametes[j], gametes[i]];
  }

  const pairs = Math.floor(gametes.length / 2);
  const survivors: [number, number][] = [];
  for (let i = 0; i < pairs; i += 1) {
    const first = gametes[i];
    const second = gametes[i + pairs];
    if (Math.random() < survivalProbability(first + second, params)) {
      survivors.push([first, second]);
    }
  }

  if (survivors.length === 0) return null;

  const next = Array.from({ length: N_POP }, () => {
    const pair = survivors[Math.floor(Math.random() * survivors.length)];
    const inherited = pair[Math.random() < 0.5 ? 0 : 1];
    return clamp(normal(inherited, MUTATION_SD), 1, 100);
  });

  return summarize(next, current.generation + 1, survivors.length / pairs, gametes.length);
}

function format(value: number, digits = 1) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function LineChart({ history }: { history: Snapshot[] }) {
  const width = 780;
  const height = 260;
  const pad = { left: 42, right: 18, top: 24, bottom: 34 };
  const maxGeneration = Math.max(MAX_GENERATIONS, history.at(-1)?.generation ?? 0);
  const values = history.flatMap((d) => [d.p10, d.p90]);
  const maxY = Math.max(25, Math.ceil(Math.max(...values, 20) / 5) * 5);
  const x = (generation: number) => pad.left + (generation / maxGeneration) * (width - pad.left - pad.right);
  const y = (value: number) => height - pad.bottom - (value / maxY) * (height - pad.top - pad.bottom);
  const path = (accessor: (d: Snapshot) => number) =>
    history.map((d, i) => `${i === 0 ? "M" : "L"}${x(d.generation).toFixed(1)},${y(accessor(d)).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolução do tamanho dos gametas ao longo das gerações">
      {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
        const value = maxY * fraction;
        return <g key={fraction}><line x1={pad.left} x2={width - pad.right} y1={y(value)} y2={y(value)} className="grid-line" /><text x={pad.left - 9} y={y(value) + 4} textAnchor="end" className="axis-label">{value}</text></g>;
      })}
      <path d={`${path((d) => d.p90)} ${[...history].reverse().map((d) => `L${x(d.generation).toFixed(1)},${y(d.p10).toFixed(1)}`).join(" ")} Z`} className="range-area" />
      <path d={path((d) => d.mean)} className="mean-line" />
      <path d={path((d) => d.p90)} className="edge-line large" />
      <path d={path((d) => d.p10)} className="edge-line small" />
      <text x={pad.left} y={height - 8} className="axis-label">0</text>
      <text x={width - pad.right} y={height - 8} textAnchor="end" className="axis-label">{MAX_GENERATIONS} gerações</text>
    </svg>
  );
}

function Histogram({ population }: { population: number[] }) {
  const bins = 24;
  const maxValue = Math.max(30, Math.ceil(Math.max(...population) / 5) * 5);
  const counts = Array(bins).fill(0) as number[];
  population.forEach((value) => { counts[Math.min(bins - 1, Math.floor((value / maxValue) * bins))] += 1; });
  const top = Math.max(...counts);
  return (
    <div className="histogram" role="img" aria-label="Distribuição atual do tamanho dos gametas">
      {counts.map((count, i) => <div key={i} className="hist-bar" style={{ height: `${Math.max(2, (count / top) * 100)}%`, opacity: 0.4 + (i / bins) * 0.6 }} title={`${count} gametas parentais`} />)}
      <span className="hist-label left">1</span><span className="hist-label right">{maxValue} u.</span>
    </div>
  );
}

function SurvivalCurve({ params }: { params: Params }) {
  const width = 390, height = 180, left = 35, right = 10, top = 15, bottom = 28;
  const x = (value: number) => left + (value / 60) * (width - left - right);
  const y = (value: number) => height - bottom - value * (height - top - bottom);
  const points = Array.from({ length: 121 }, (_, i) => i * 0.5);
  const d = points.map((value, i) => `${i ? "L" : "M"}${x(value).toFixed(1)},${y(survivalProbability(value, params)).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Curva de sobrevivência do zigoto">
      <line x1={left} x2={width - right} y1={y(0)} y2={y(0)} className="axis-line" />
      <line x1={left} x2={left} y1={top} y2={y(0)} className="axis-line" />
      <line x1={x(params.x0)} x2={x(params.x0)} y1={top} y2={y(0)} className="threshold-line" />
      <path d={d} className="survival-line" />
      <text x={left} y={height - 7} className="axis-label">0</text><text x={width - right} y={height - 7} textAnchor="end" className="axis-label">60 tamanho do zigoto</text>
      <text x={left - 7} y={top + 4} textAnchor="end" className="axis-label">1</text>
      <text x={Math.min(width - 45, x(params.x0) + 6)} y={top + 10} className="threshold-label">x₀</text>
    </svg>
  );
}

function Parameter({ label, symbol, value, min, max, step, onChange, hint }: { label: string; symbol: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; hint: string }) {
  return (
    <label className="parameter">
      <span className="parameter-head"><span><b>{symbol}</b> {label}</span><output>{value.toLocaleString("pt-BR")}</output></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <small>{hint}</small>
    </label>
  );
}

export default function Home() {
  const initial = useMemo(() => summarize(makeInitialPopulation(DEFAULT_PARAMS.x0)), []);
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [history, setHistory] = useState<Snapshot[]>([initial]);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(3);
  const [extinct, setExtinct] = useState(false);
  const paramsRef = useRef(params);
  const latest = history.at(-1) ?? initial;

  useEffect(() => { paramsRef.current = params; }, [params]);

  const advance = useCallback(() => {
    setHistory((previous) => {
      const current = previous.at(-1)!;
      if (current.generation >= MAX_GENERATIONS) { setRunning(false); return previous; }
      const next = nextGeneration(current, paramsRef.current);
      if (!next) { setExtinct(true); setRunning(false); return previous; }
      return [...previous, next];
    });
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(advance, Math.max(32, 340 / speed));
    return () => window.clearInterval(timer);
  }, [running, speed, advance]);

  const reset = () => {
    setRunning(false);
    const fresh = summarize(makeInitialPopulation(params.x0));
    setHistory([fresh]);
    setExtinct(false);
  };

  const updateParam = (key: keyof Params, value: number) => {
    setParams((current) => ({ ...current, [key]: value }));
    if (key === "x0") {
      setHistory((previous) => previous.at(-1)?.generation === 0
        ? [summarize(makeInitialPopulation(value))]
        : previous);
    }
  };
  const restoreParams = () => {
    setParams(DEFAULT_PARAMS);
    setHistory((previous) => previous.at(-1)?.generation === 0
      ? [summarize(makeInitialPopulation(DEFAULT_PARAMS.x0))]
      : previous);
  };
  const difference = latest.p90 / latest.p10;

  return (
    <main>
      <header className="topbar">
        <a href="#inicio" className="brand"><span className="brand-mark">●</span> Anisogamia <em>lab</em></a>
        <nav aria-label="Navegação principal"><a href="#simulacao">Simulação</a><a href="#modelo">O modelo</a><a href="#pressupostos">Pressupostos</a></nav>
        <a className="code-link" href="#equacoes">Ver equações</a>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-copy">
          <span className="eyebrow"><i /> MODELO EVOLUTIVO INTERATIVO</span>
          <h1>Quando o tamanho<br />divide estratégias.</h1>
          <p>Observe uma população de gametas evoluir sob duas forças opostas: produzir muitos gametas pequenos ou formar zigotos grandes que sobrevivem melhor.</p>
          <a className="primary-button" href="#simulacao">Explorar a dinâmica <span>↓</span></a>
        </div>
        <div className="hero-visual" aria-label="Ilustração abstrata de gametas de tamanhos diferentes">
          <div className="orb orb-large"><span>Zigoto<br /><b>maior</b></span></div>
          <div className="orb orb-mid" /><div className="orb orb-small one" /><div className="orb orb-small two" /><div className="orb orb-tiny three" /><div className="orb orb-tiny four" />
          <div className="orbit orbit-a" /><div className="orbit orbit-b" />
          <div className="visual-note"><span>↗</span><p><b>Duas pressões</b><br />fecundidade × sobrevivência</p></div>
        </div>
      </section>

      <section className="simulation-section" id="simulacao">
        <div className="section-intro"><div><span className="section-number">01</span><p className="kicker">SIMULAÇÃO AO VIVO</p><h2>Veja a seleção acontecer.</h2></div><p>Cada ponto no tempo representa uma geração. Ajuste a sobrevivência do zigoto e observe se a população converge, se dispersa ou se divide em estratégias.</p></div>

        <div className="lab-grid">
          <aside className="control-panel">
            <div className="panel-title"><span>Controles</span><button onClick={restoreParams}>Restaurar</button></div>
            <div className="curve-card"><div><span>Sobrevivência do zigoto</span><b>S(z)</b></div><SurvivalCurve params={params} /></div>
            <Parameter label="Ponto médio" symbol="x₀" value={params.x0} min={5} max={50} step={1} onChange={(v) => updateParam("x0", v)} hint="Tamanho em que a curva atinge metade de L." />
            <Parameter label="Sobrevivência máxima" symbol="L" value={params.L} min={0.1} max={1} step={0.05} onChange={(v) => updateParam("L", v)} hint="Teto da probabilidade de sobrevivência." />
            <Parameter label="Inclinação" symbol="k" value={params.k} min={0.05} max={1} step={0.05} onChange={(v) => updateParam("k", v)} hint="Quão abrupta é a transição da curva." />
            <div className="formula-mini">S(z) = <span>{format(params.L, 2)}</span> / [1 + e<sup>−{format(params.k, 2)}(z − {params.x0})</sup>]</div>
          </aside>

          <div className="results-panel">
            <div className="simulation-toolbar">
              <div className="generation"><small>GERAÇÃO</small><strong>{String(latest.generation).padStart(3, "0")}</strong><span>/ {MAX_GENERATIONS}</span></div>
              <div className="playback">
                <button className="icon-button" onClick={reset} title="Reiniciar" aria-label="Reiniciar simulação">↺</button>
                <button className="play-button" onClick={() => setRunning((value) => !value)} disabled={latest.generation >= MAX_GENERATIONS || extinct}>{running ? "Ⅱ  Pausar" : "▶  Iniciar"}</button>
                <button className="icon-button" onClick={advance} disabled={running || latest.generation >= MAX_GENERATIONS || extinct} title="Avançar uma geração" aria-label="Avançar uma geração">→</button>
              </div>
              <label className="speed">Velocidade <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}><option value={1}>1×</option><option value={3}>3×</option><option value={6}>6×</option><option value={10}>10×</option></select></label>
            </div>

            {extinct && <div className="extinction-alert"><b>Extinção nesta geração.</b> Nenhum zigoto sobreviveu com estes parâmetros. Ajuste a curva ou reinicie.</div>}

            <div className="chart-card">
              <div className="chart-heading"><div><small>TAMANHO DOS GAMETAS</small><h3>Trajetória evolutiva</h3></div><div className="legend"><span className="legend-large">90º percentil</span><span className="legend-mean">Média</span><span className="legend-small">10º percentil</span></div></div>
              <LineChart history={history} />
            </div>

            <div className="metrics-grid">
              <article><small>TAMANHO MÉDIO</small><strong>{format(latest.mean, 2)}</strong><span>unidades de energia</span></article>
              <article><small>DIFERENÇA</small><strong>{format(difference, 2)}×</strong><span>razão P90 / P10</span></article>
              <article><small>SOBREVIVÊNCIA</small><strong>{latest.generation ? format(latest.survival * 100, 1) : "—"}<em>{latest.generation ? "%" : ""}</em></strong><span>zigotos na última geração</span></article>
              <article className="distribution"><div><small>DISTRIBUIÇÃO ATUAL</small><b>n = {N_POP}</b></div><Histogram population={latest.population} /></article>
            </div>
          </div>
        </div>
      </section>

      <section className="model-section" id="modelo">
        <div className="section-intro light"><div><span className="section-number">02</span><p className="kicker">POR DENTRO DO MODELO</p><h2>Uma disputa entre<br />quantidade e qualidade.</h2></div><p>A anisogamia — gametas de tamanhos diferentes — pode emergir quando cada unidade de energia precisa ser dividida entre produzir muitos gametas ou investir em poucos gametas grandes.</p></div>
        <div className="mechanism-grid">
          <article><span className="mechanism-icon">•••</span><small>PRESSÃO 01</small><h3>Mais chances de encontro</h3><p>Com energia fixa, indivíduos de gametas pequenos produzem mais unidades e aparecem mais vezes no conjunto reprodutivo.</p><div className="equation">N<sub>gam</sub> = <span>E</span> / tamanho</div></article>
          <div className="versus">×</div>
          <article><span className="mechanism-icon large-icon">●</span><small>PRESSÃO 02</small><h3>Mais chance de sobreviver</h3><p>Gametas grandes formam zigotos maiores. A função sigmoide transforma esse tamanho em probabilidade de sobrevivência.</p><div className="equation">S(z) = <span>L</span> / (1 + e<sup>−k(z−x₀)</sup>)</div></article>
          <div className="outcome"><span>RESULTADO POSSÍVEL</span><b>◌</b><b>•</b><p>Estratégias <strong>grande</strong> e <strong>pequena</strong> podem coexistir.</p></div>
        </div>
      </section>

      <section className="steps-section" id="equacoes">
        <div className="steps-heading"><span className="section-number">03</span><p className="kicker">A CADA GERAÇÃO</p><h2>Do adulto ao descendente<br />em quatro passos.</h2></div>
        <div className="steps-grid">
          <article><b>1</b><h3>Produção</h3><p>Cada um dos 1.000 indivíduos dispõe de 100 unidades de energia e produz <i>100 / tamanho</i> gametas.</p></article>
          <article><b>2</b><h3>Encontro</h3><p>Todos os gametas entram em um pool comum, são embaralhados e combinados aleatoriamente em pares.</p></article>
          <article><b>3</b><h3>Seleção</h3><p>O tamanho do zigoto é a soma do par. Sua sobrevivência é sorteada pela curva sigmoide configurada.</p></article>
          <article><b>4</b><h3>Herança</h3><p>Cada descendente herda o tamanho de um dos pais, recebe uma mutação normal (σ = 0,5) e integra a nova geração.</p></article>
        </div>
      </section>

      <section className="assumptions-section" id="pressupostos">
        <div><span className="section-number">04</span><p className="kicker">LEIA ANTES DE INTERPRETAR</p><h2>O que este mundo<br />simplifica.</h2><p className="assumption-lead">Este é um modelo conceitual, não uma reconstrução completa da evolução dos sexos. Seu valor está em isolar um mecanismo e tornar suas consequências visíveis.</p></div>
        <div className="assumptions-list">
          <details open><summary><span>01</span> População e energia fixas <i>+</i></summary><p>A população permanece em 1.000 indivíduos e todos recebem 100 unidades de energia. Se sobrevivem menos de 1.000 zigotos, os sobreviventes podem deixar mais de um descendente para recompor a população.</p></details>
          <details><summary><span>02</span> Encontros inteiramente aleatórios <i>+</i></summary><p>Não há preferência, compatibilidade, competição direta entre gametas nem estrutura espacial. Qualquer gameta pode formar par com qualquer outro.</p></details>
          <details><summary><span>03</span> Herança simplificada <i>+</i></summary><p>O descendente copia o valor de apenas um dos dois gametas parentais, acrescido de variação aleatória. Não há genes, dominância ou recombinação explícitos.</p></details>
          <details><summary><span>04</span> Uma única fonte de seleção <i>+</i></summary><p>Após a fecundação, somente o tamanho total do zigoto afeta a sobrevivência. Outros custos e benefícios biológicos não estão representados.</p></details>
        </div>
      </section>

      <footer><a href="#inicio" className="brand"><span className="brand-mark">●</span> Anisogamia <em>lab</em></a><p>Um laboratório conceitual para explorar a evolução do tamanho dos gametas.</p><a href="#inicio">Voltar ao topo ↑</a></footer>
    </main>
  );
}
