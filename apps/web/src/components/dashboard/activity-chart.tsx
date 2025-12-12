"use client";

import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { getTasksDailyStats } from "@/lib/api";

const chartConfig = {
  completed: {
    label: "Завершено",
    color: "oklch(0.65 0.18 250)",
  },
  failed: {
    label: "Ошибки",
    color: "oklch(0.55 0.22 25)",
  },
} satisfies ChartConfig;

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

export function ActivityChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["daily-stats"],
    queryFn: () => getTasksDailyStats(7),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Активность</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData =
    data?.stats.map((s) => ({
      date: formatDate(s.date),
      completed: s.completed,
      failed: s.failed,
    })) ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="font-medium text-base">
            Активность за 7 дней
          </CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-primary" />
              <span className="text-muted-foreground">
                {data?.total_completed ?? 0} завершено
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-destructive" />
              <span className="text-muted-foreground">
                {data?.total_failed ?? 0} ошибок
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer className="h-[200px] w-full" config={chartConfig}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id="completedGradient"
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="oklch(0.65 0.18 250)"
                  stopOpacity={0.4}
                />
                <stop
                  offset="100%"
                  stopColor="oklch(0.65 0.18 250)"
                  stopOpacity={0}
                />
              </linearGradient>
              <linearGradient id="failedGradient" x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="oklch(0.55 0.22 25)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="100%"
                  stopColor="oklch(0.55 0.22 25)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              horizontal
              stroke="oklch(0.3 0.02 260 / 0.2)"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              axisLine={false}
              dataKey="date"
              stroke="oklch(0.5 0.01 260)"
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              axisLine={false}
              stroke="oklch(0.5 0.01 260)"
              tickLine={false}
              tickMargin={8}
              width={30}
            />
            <ChartTooltip
              content={<ChartTooltipContent />}
              cursor={{ stroke: "oklch(0.5 0.02 260 / 0.3)" }}
            />
            <Area
              dataKey="completed"
              fill="url(#completedGradient)"
              fillOpacity={1}
              name="completed"
              stackId="1"
              stroke="oklch(0.65 0.18 250)"
              strokeWidth={2}
              type="monotone"
            />
            <Area
              dataKey="failed"
              fill="url(#failedGradient)"
              fillOpacity={1}
              name="failed"
              stackId="2"
              stroke="oklch(0.55 0.22 25)"
              strokeWidth={2}
              type="monotone"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
