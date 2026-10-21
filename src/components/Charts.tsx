// Gráficas SVG ligeras: LineChart (serie temporal) y BarChart.
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useI18n } from '../i18n';
import { formatDate } from '../lib/dates';
import { useTheme } from '../theme';

// Hook: mide el ancho disponible del contenedor.
function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const nw = Math.round(e.nativeEvent.layout.width);
    if (nw !== w) setW(nw);
  };
  return [w, onLayout];
}

const defaultFormatY = (n: number) => {
  const abs = Math.abs(n);
  const d = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return String(Number(n.toFixed(d)));
};

// ---------- LineChart ----------
export interface LineChartProps {
  data: { x: string; y: number }[];
  height?: number;
  color?: string;
  formatY?: (n: number) => string;
  formatX?: (x: string) => string;
}

export function LineChart({ data, height = 160, color, formatY = defaultFormatY, formatX }: LineChartProps) {
  const { c } = useTheme();
  const { lang } = useI18n();
  const [width, onLayout] = useWidth();
  const stroke = color ?? c.accent;
  const pts = data.filter((d) => Number.isFinite(d.y));
  const fx = (x: string) => {
    if (formatX) return formatX(x);
    // Fechas YYYY-MM-DD; si no encaja, se muestra tal cual.
    return /^\d{4}-\d{2}-\d{2}$/.test(x) ? formatDate(x, lang) : x;
  };

  // Márgenes internos del área de dibujo.
  const padL = 40;
  const padR = 12;
  const padT = 10;
  const padB = 22;
  const plotW = Math.max(0, width - padL - padR);
  const plotH = Math.max(0, height - padT - padB);

  let content = null;
  if (width > 0) {
    if (pts.length < 2) {
      // Estado vacío: línea punteada atenuada, sin cifras inventadas.
      const yMid = padT + plotH / 2;
      content = (
        <G>
          {[0, 0.5, 1].map((f) => (
            <Line
              key={f}
              x1={padL}
              x2={width - padR}
              y1={padT + plotH * f}
              y2={padT + plotH * f}
              stroke={c.border}
              strokeWidth={1}
            />
          ))}
          <Line
            x1={padL}
            x2={width - padR}
            y1={yMid}
            y2={yMid}
            stroke={c.muted}
            strokeOpacity={0.5}
            strokeWidth={2}
            strokeDasharray="6 6"
            strokeLinecap="round"
          />
          {pts.length === 1 ? (
            <Circle cx={width - padR - 4} cy={yMid} r={4} fill={stroke} />
          ) : null}
        </G>
      );
    } else {
      const ys = pts.map((p) => p.y);
      let min = Math.min(...ys);
      let max = Math.max(...ys);
      if (min === max) {
        // Evita división por cero con un rango mínimo.
        const pad = Math.abs(min) * 0.05 || 1;
        min -= pad;
        max += pad;
      } else {
        const pad = (max - min) * 0.08;
        min -= pad;
        max += pad;
      }
      const sx = (i: number) => padL + (plotW * i) / (pts.length - 1);
      const sy = (y: number) => padT + plotH * (1 - (y - min) / (max - min));
      const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
      const area = `${d} L${sx(pts.length - 1).toFixed(1)},${padT + plotH} L${padL},${padT + plotH} Z`;
      const last = pts[pts.length - 1];
      const realMin = Math.min(...ys);
      const realMax = Math.max(...ys);

      content = (
        <G>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <Line
              key={f}
              x1={padL}
              x2={width - padR}
              y1={padT + plotH * f}
              y2={padT + plotH * f}
              stroke={c.border}
              strokeWidth={1}
              strokeOpacity={f === 1 ? 1 : 0.6}
            />
          ))}
          {/* Etiquetas Y: máximo y mínimo reales */}
          <SvgText x={padL - 6} y={sy(realMax) + 4} fontSize={10} fill={c.muted} textAnchor="end">
            {formatY(realMax)}
          </SvgText>
          {realMin !== realMax ? (
            <SvgText x={padL - 6} y={sy(realMin) + 4} fontSize={10} fill={c.muted} textAnchor="end">
              {formatY(realMin)}
            </SvgText>
          ) : null}
          <Path d={area} fill={stroke} fillOpacity={0.08} />
          <Path d={d} stroke={stroke} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <Circle cx={sx(pts.length - 1)} cy={sy(last.y)} r={6} fill={stroke} fillOpacity={0.25} />
          <Circle cx={sx(pts.length - 1)} cy={sy(last.y)} r={3.5} fill={stroke} />
          {/* Etiquetas X: primera y última fecha */}
          <SvgText x={padL} y={height - 6} fontSize={10} fill={c.muted} textAnchor="start">
            {fx(pts[0].x)}
          </SvgText>
          <SvgText x={width - padR} y={height - 6} fontSize={10} fill={c.muted} textAnchor="end">
            {fx(last.x)}
          </SvgText>
        </G>
      );
    }
  }

  return (
    <View onLayout={onLayout} style={{ width: '100%', height }} accessibilityRole="image">
      {width > 0 ? (
        <Svg width={width} height={height}>
          {content}
        </Svg>
      ) : null}
    </View>
  );
}

// ---------- BarChart ----------
export interface BarChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  max?: number;
  highlightIndex?: number;
}

export function BarChart({ data, height = 120, color, max, highlightIndex }: BarChartProps) {
  const { c } = useTheme();
  const [width, onLayout] = useWidth();
  const fill = color ?? c.accent;
  const padB = 18;
  const padT = 4;
  const plotH = Math.max(0, height - padB - padT);
  const n = data.length;
  const top = Math.max(max ?? 0, ...data.map((d) => (Number.isFinite(d.value) ? d.value : 0)), 0) || 1;
  const slot = n > 0 ? width / n : 0;
  const barW = Math.max(4, Math.min(28, slot * 0.6));

  return (
    <View onLayout={onLayout} style={{ width: '100%', height }} accessibilityRole="image">
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Line x1={0} x2={width} y1={padT + plotH} y2={padT + plotH} stroke={c.border} strokeWidth={1} />
          {data.map((d, i) => {
            const v = Number.isFinite(d.value) ? Math.max(0, d.value) : 0;
            const h = Math.min(plotH, (v / top) * plotH);
            const x = slot * i + (slot - barW) / 2;
            const dim = highlightIndex !== undefined && highlightIndex !== i;
            return (
              <G key={`${d.label}-${i}`}>
                {/* Pista de fondo */}
                <Rect x={x} y={padT} width={barW} height={plotH} rx={Math.min(6, barW / 2)} fill={c.surface2} />
                {h > 0 ? (
                  <Rect
                    x={x}
                    y={padT + plotH - h}
                    width={barW}
                    height={h}
                    rx={Math.min(6, barW / 2, h / 2)}
                    fill={fill}
                    fillOpacity={dim ? 0.45 : 1}
                  />
                ) : null}
                <SvgText x={x + barW / 2} y={height - 4} fontSize={10} fill={c.muted} textAnchor="middle">
                  {d.label}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}
