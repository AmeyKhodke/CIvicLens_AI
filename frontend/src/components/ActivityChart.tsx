'use client';
import { useState } from 'react';

interface DataPoint {
  name: string;
  docs: number;
  mtgs: number;
}

const chartData: DataPoint[] = [
  { name: 'Mon', docs: 4, mtgs: 2 },
  { name: 'Tue', docs: 7, mtgs: 5 },
  { name: 'Wed', docs: 5, mtgs: 3 },
  { name: 'Thu', docs: 8, mtgs: 4 },
  { name: 'Fri', docs: 6, mtgs: 6 },
  { name: 'Sat', docs: 2, mtgs: 1 },
  { name: 'Sun', docs: 3, mtgs: 2 },
];

export default function ActivityChart() {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 35 };

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const maxVal = 10;

  const getX = (index: number) => padding.left + (index / (chartData.length - 1)) * innerWidth;
  const getY = (val: number) => padding.top + innerHeight - (val / maxVal) * innerHeight;

  // Build SVG path for smooth line
  const createSmoothPath = (key: 'docs' | 'mtgs') => {
    return chartData.reduce((acc, point, i, arr) => {
      const x = getX(i);
      const y = getY(point[key]);
      if (i === 0) return `M ${x},${y}`;

      const prevX = getX(i - 1);
      const prevY = getY(arr[i - 1][key]);
      const cp1x = prevX + (x - prevX) / 2;
      const cp2x = prevX + (x - prevX) / 2;
      return `${acc} C ${cp1x},${prevY} ${cp2x},${y} ${x},${y}`;
    }, '');
  };

  const docsPath = createSmoothPath('docs');
  const mtgsPath = createSmoothPath('mtgs');

  const docsAreaPath = `${docsPath} L ${getX(chartData.length - 1)},${padding.top + innerHeight} L ${getX(0)},${padding.top + innerHeight} Z`;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', userSelect: 'none' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: '100%', overflow: 'visible' }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d4a843" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#d4a843" stopOpacity={0.0} />
          </linearGradient>
          <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.0} />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 2.5, 5, 7.5, 10].map((val) => {
          const y = getY(val);
          return (
            <g key={val}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
              <text
                x={padding.left - 8}
                y={y + 3.5}
                fill="#64748b"
                fontSize={10}
                textAnchor="end"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Filled area for documents */}
        <path d={docsAreaPath} fill="url(#goldGrad)" />

        {/* Lines */}
        <path d={docsPath} fill="none" stroke="#d4a843" strokeWidth={2.5} strokeLinecap="round" />
        <path d={mtgsPath} fill="none" stroke="#8b5cf6" strokeWidth={2.5} strokeLinecap="round" strokeDasharray="3 3" />

        {/* X-axis labels & vertical highlight column on hover */}
        {chartData.map((d, i) => {
          const x = getX(i);
          const isHovered = hoverIndex === i;
          return (
            <g key={d.name}>
              {isHovered && (
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={padding.top + innerHeight}
                  stroke="rgba(212, 168, 67, 0.3)"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                />
              )}

              {/* Data points */}
              <circle
                cx={x}
                cy={getY(d.docs)}
                r={isHovered ? 5 : 3.5}
                fill="#d4a843"
                stroke="#0a1628"
                strokeWidth={2}
                style={{ transition: 'all 0.15s ease' }}
              />
              <circle
                cx={x}
                cy={getY(d.mtgs)}
                r={isHovered ? 5 : 3.5}
                fill="#8b5cf6"
                stroke="#0a1628"
                strokeWidth={2}
                style={{ transition: 'all 0.15s ease' }}
              />

              <text
                x={x}
                y={height - 8}
                fill={isHovered ? '#f0d078' : '#64748b'}
                fontSize={11}
                fontWeight={isHovered ? 700 : 500}
                textAnchor="middle"
              >
                {d.name}
              </text>

              {/* Interactive invisible hover overlay for each column */}
              <rect
                x={x - innerWidth / (chartData.length * 2)}
                y={0}
                width={innerWidth / chartData.length}
                height={height}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              />
            </g>
          );
        })}
      </svg>

      {/* Floating Hover Tooltip */}
      {hoverIndex !== null && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: `${(hoverIndex / (chartData.length - 1)) * 80 + 10}%`,
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(212, 168, 67, 0.3)',
            backdropFilter: 'blur(10px)',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <div style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 2 }}>
            {chartData[hoverIndex].name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f0d078', fontSize: 11 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#d4a843' }} />
            <span>Documents Analyzed: <strong>{chartData[hoverIndex].docs}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#a78bfa', fontSize: 11, marginTop: 2 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6' }} />
            <span>Meetings Consulted: <strong>{chartData[hoverIndex].mtgs}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
