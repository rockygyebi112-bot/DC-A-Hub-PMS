"use client";

import { useRef, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import * as echarts from "echarts";
import { cn } from "@/lib/utils";

interface EChartProps {
  option: echarts.EChartsOption;
  /** Explicit pixel height. When omitted, uses responsive Tailwind class h-56 lg:h-72 */
  height?: number;
  className?: string;
}

export function EChart({ option, height, className }: EChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const initChart = useCallback(() => {
    if (!chartRef.current) return;
    if (instanceRef.current) {
      instanceRef.current.dispose();
      instanceRef.current = null;
    }
    instanceRef.current = echarts.init(chartRef.current, isDark ? "dark" : undefined);
  }, [isDark]);

  useEffect(() => {
    initChart();

    const handleResize = () => instanceRef.current?.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, [initChart]);

  useEffect(() => {
    if (instanceRef.current) {
      instanceRef.current.setOption(
        { ...option, backgroundColor: "transparent" },
        { notMerge: true }
      );
    }
  }, [option]);

  return (
    <div
      ref={chartRef}
      style={{ width: "100%", ...(height !== undefined ? { height } : {}) }}
      className={cn(height === undefined ? "h-64 lg:h-72" : undefined, className)}
    />
  );
}
