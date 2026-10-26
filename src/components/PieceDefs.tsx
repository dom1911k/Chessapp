// Gradients used by the unlockable piece sets (fill="url(#pg-…)"). Rendered once.
const g = (id: string, stops: [number, string][], angle = '0.2 0 0.8 1') => {
  const [x1, y1, x2, y2] = angle.split(' ');
  return (
    <linearGradient key={id} id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
      {stops.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}
    </linearGradient>
  );
};

export function PieceDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        {g('pg-marble-w', [[0, '#ffffff'], [0.45, '#eceae6'], [0.5, '#c9c6c0'], [0.56, '#efede9'], [1, '#d9d5ce']])}
        {g('pg-marble-b', [[0, '#5a5f66'], [0.45, '#2b2f35'], [0.5, '#6b7078'], [0.56, '#26292e'], [1, '#121417']])}
        {g('pg-glass-w', [[0, 'rgba(255,255,255,0.95)'], [0.5, 'rgba(210,235,255,0.8)'], [1, 'rgba(160,205,240,0.85)']])}
        {g('pg-glass-b', [[0, 'rgba(90,120,220,0.95)'], [0.5, 'rgba(40,60,150,0.9)'], [1, 'rgba(15,25,80,0.95)']])}
        {g('pg-ruby', [[0, '#fb7185'], [0.5, '#e11d48'], [1, '#881337']])}
        {g('pg-sapphire', [[0, '#60a5fa'], [0.5, '#1d4ed8'], [1, '#172554']])}
        {g('pg-gold', [[0, '#fef3c7'], [0.35, '#fcd34d'], [0.7, '#d4a017'], [1, '#a16207']])}
        {g('pg-silver', [[0, '#e5e7eb'], [0.4, '#9ca3af'], [0.75, '#4b5563'], [1, '#1f2937']])}
        {g('pg-ivory', [[0, '#fffdf5'], [1, '#e8dcc0']])}
        {g('pg-jade', [[0, '#34d399'], [0.5, '#059669'], [1, '#064e3b']])}
        {g('pg-bronze', [[0, '#f5c99b'], [0.5, '#c27c3e'], [1, '#7c4a1e']])}
      </defs>
    </svg>
  );
}
