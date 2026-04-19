"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartComponent = (
  props: Record<string, unknown> & { children?: ReactNode },
) => JSX.Element;

const ChartResponsiveContainer =
  ResponsiveContainer as unknown as ChartComponent;
const ChartBarChart = BarChart as unknown as ChartComponent;
const ChartCartesianGrid = CartesianGrid as unknown as ChartComponent;
const ChartXAxis = XAxis as unknown as ChartComponent;
const ChartYAxis = YAxis as unknown as ChartComponent;
const ChartTooltip = Tooltip as unknown as ChartComponent;
const ChartBar = Bar as unknown as ChartComponent;

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
      <ChartResponsiveContainer width="100%" height={320}>
        <ChartBarChart
          data={data}
          margin={{ top: 16, right: 24, left: 0, bottom: 32 }}
          role="img"
          aria-label={titleText}
        >
          <title>{titleText}</title>
          <desc>{descText}</desc>
          <ChartCartesianGrid strokeDasharray="3 3" stroke="rgb(229 229 229)" />
          <ChartXAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "rgb(64 64 64)" }}
            interval={0}
            angle={-25}
            textAnchor="end"
            height={64}
          />
          <ChartYAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "rgb(64 64 64)" }}
            unit="%"
          />
          <ChartTooltip
            formatter={(value: unknown) => {
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
          <ChartBar
            dataKey="compliance"
            fill="rgb(4 120 87)"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        </ChartBarChart>
      </ChartResponsiveContainer>
    </figure>
  );
}
