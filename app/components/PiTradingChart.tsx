"use client";

import {
  createChart,
  LineSeries,
} from "lightweight-charts";

import {
  useEffect,
  useRef,
} from "react";

interface Props {
  data: number[];
  color?: string;
}

export default function PiTradingChart({
  data,
  color = "#34d399",
}: Props) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      !containerRef.current ||
      data.length < 2
    )
      return;

    const chart = createChart(
      containerRef.current,
      {
        width:
          containerRef.current
            .clientWidth,

        height: 220,

        layout: {
          background: {
            color: "transparent",
          },
          textColor:
            "rgba(255,255,255,0.5)",
        },

        grid: {
          vertLines: {
            color:
              "rgba(255,255,255,0.05)",
          },
          horzLines: {
            color:
              "rgba(255,255,255,0.05)",
          },
        },

        rightPriceScale: {
          borderVisible: false,
        },

        timeScale: {
          borderVisible: false,
          timeVisible: true,
        },

        crosshair: {
          vertLine: {
            visible: true,
          },
          horzLine: {
            visible: true,
          },
        },
      }
    );

    const series =
      chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
      });

    series.setData(
      data.map(
        (price, index) => ({
          time:
            index + 1,
          value: price,
        })
      )
    );

    chart.timeScale().fitContent();

    const resize = () => {
      chart.applyOptions({
        width:
          containerRef.current
            ?.clientWidth ?? 0,
      });
    };

    window.addEventListener(
      "resize",
      resize
    );

    return () => {
      window.removeEventListener(
        "resize",
        resize
      );

      chart.remove();
    };
  }, [data, color]);

  return (
    <div
      ref={containerRef}
      className="
        h-[220px]
        w-full
      "
    />
  );
}
