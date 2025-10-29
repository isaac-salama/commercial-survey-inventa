"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import type { EChartsOption } from "echarts";
import type { EChartsReactProps } from "echarts-for-react";

type Datum = { label: string; value: number; max: number };

const ReactECharts = dynamic(() => import("echarts-for-react").then((m) => m.default), { ssr: false }) as React.ComponentType<EChartsReactProps>;

type Props = {
  data: Datum[];
  height?: number;
  className?: string;
};

export default function ResultsRadar({ data, height = 360, className }: Props) {
  const indicator = React.useMemo(() => data.map((d) => ({ name: d.label, max: d.max || 5 })), [data]);
  const values = React.useMemo(() => data.map((d) => d.value ?? 0), [data]);

  const option: EChartsOption = React.useMemo(() => {
    const brand = "#3135ef";
    return {
      tooltip: {
        trigger: "item",
        formatter: (params) => {
          const vRaw = (params as { value?: unknown })?.value;
          const v = Array.isArray(vRaw) ? vRaw : [];
          const items = indicator
            .map((ind, i: number) => {
              const val = v[i] as unknown;
              const num = typeof val === "number" ? val : Number(val ?? 0);
              const text = Number.isFinite(num) ? num.toFixed(2) : String(val ?? 0);
              return `${ind.name}: <b>${text}</b>`;
            })
            .join("<br/>");
          return `<div style=\"font-size:12px\"><div style=\"margin-bottom:6px\"><b>Dimensões</b></div>${items}</div>`;
        },
      },
      radar: {
        indicator,
        shape: "polygon",
        center: ["50%", "55%"],
        radius: "70%",
        splitNumber: 5,
        axisName: {
          color: "#111827",
          fontSize: 12,
        },
        splitArea: {
          areaStyle: {
            color: [
              "rgba(49,53,239,0.06)",
              "rgba(49,53,239,0.08)",
              "rgba(49,53,239,0.10)",
              "rgba(49,53,239,0.12)",
              "rgba(49,53,239,0.14)",
            ],
          },
        },
        splitLine: {
          lineStyle: {
            color: "rgba(49,53,239,0.25)",
          },
        },
        axisLine: {
          lineStyle: {
            color: "rgba(49,53,239,0.25)",
          },
        },
      },
      series: [
        {
          type: "radar",
          name: "Score",
          data: [
            {
              value: values,
            },
          ],
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(49,53,239,0.45)" },
                { offset: 1, color: "rgba(49,53,239,0.15)" },
              ],
            },
          },
          lineStyle: {
            color: brand,
            width: 2,
            shadowColor: "rgba(49,53,239,0.5)",
            shadowBlur: 8,
          },
          symbol: "circle",
          symbolSize: 6,
          itemStyle: {
            color: "#ffffff",
            borderColor: brand,
            borderWidth: 2,
            shadowColor: "rgba(49,53,239,0.4)",
            shadowBlur: 6,
          },
          animationDuration: 1200,
          animationEasing: "elasticOut",
        },
      ],
      animationDuration: 1200,
      animationEasing: "elasticOut",
    };
  }, [indicator, values]);

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      aria-label="Radar de resultados por dimensão"
    >
      <ReactECharts option={option} style={{ width: "100%", height }} />
    </motion.div>
  );
}
