"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type SlaBarDatum = {
  key: string;
  label: string;
  compliance: number; // 0..100
};

/**
 * Accessible bar chart for SLA compliance per secretaría.
 *
 * Renders a `<title>`/`<desc>` pair inside the `<svg>` so screen readers can
 * announce the chart summary. The surrounding `<figure>` links to the
 * keyboard-navigable `<table>` fallback below the chart.
 */
export function SlaBarChart({
  data,
  titleText,
  descText,
}: {
  data: SlaBarDatum[];
  titleText: string;
  descText: string;
}) {
  return (
    <figure className="w-full" aria-describedby="sla-chart-desc">
      <figcaption className="sr-only">{titleText}</figcaption>
      <p id="sla-chart-desc" className="sr-only">
        {descText}
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={data}
          margin={{ top: 16, right: 24, left: 0, bottom: 32 }}
          role="img"
          aria-label={titleText}
        >
          <title>{titleText}</title>
          <desc>{descText}</desc>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(229 229 229)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "rgb(64 64 64)" }}
            interval={0}
            angle={-25}
            textAnchor="end"
            height={64}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "rgb(64 64 64)" }}
            unit="%"
          />
          <Tooltip
            formatter={(value) => {
              const n = typeof value === "number" ? value : Number(value);
              return [
                Number.isFinite(n) ? `${n.toFixed(1)}%` : String(value ?? "—"),
                "Cumplimiento",
              ];
            }}
            contentStyle={{
              fontSize: 12,
              borderColor: "rgb(214 211 209)",
              borderRadius: 6,
            }}
          />
          <Bar
            dataKey="compliance"
            fill="rgb(4 120 87)"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
