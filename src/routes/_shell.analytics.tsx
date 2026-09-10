import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Gauge, Timer, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { officeName } from "@/services/api";
import { useApp } from "@/store/app-store";
import { trackingMetrics } from "@/lib/tracking-metrics";

export const Route = createFileRoute("/_shell/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — LGU DocTrack" },
      {
        name: "description",
        content: "Turnaround, bottleneck and throughput analytics across city hall offices.",
      },
      { property: "og:title", content: "Analytics — LGU DocTrack" },
      {
        property: "og:description",
        content: "Turnaround, bottleneck and throughput analytics for city hall.",
      },
    ],
  }),
  component: AnalyticsPage,
});

const BOTTLENECK_ROW_HEIGHT = 44;
const BOTTLENECK_MIN_HEIGHT = 320;

function chartOfficeLabel(office: string) {
  const normalized = office.replace(/\s+/g, " ").trim();
  return normalized.length > 28 ? `${normalized.slice(0, 27).trimEnd()}…` : normalized;
}

function AnalyticsPage() {
  const { documents } = useApp();
  const metrics = trackingMetrics(documents, officeName);
  const { volumeByDay, turnaroundByOffice } = metrics;
  const bottleneckChartHeight = Math.max(
    BOTTLENECK_MIN_HEIGHT,
    turnaroundByOffice.length * BOTTLENECK_ROW_HEIGHT + 32,
  );
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Performance of the document routing process for accessible document records."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Throughput"
          value={metrics.completedCount}
          hint="Documents completed"
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label="Median turnaround"
          value={metrics.median === null ? "—" : `${metrics.median.toFixed(1)}h`}
          hint="Registration to completion"
          icon={Timer}
        />
        <StatCard
          label="SLA compliance"
          value={metrics.compliance === null ? "—" : `${metrics.compliance}%`}
          hint="Completed by document due date"
          icon={Gauge}
          tone="warning"
        />
        <StatCard
          label="Active handlers"
          value={metrics.handlers}
          hint="Staff scanning documents"
          icon={Users}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registered vs completed</CardTitle>
          <CardDescription>Daily throughput trend.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={volumeByDay} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
              <Tooltip contentStyle={{ borderRadius: 8, borderColor: "var(--color-border)" }} />
              <Legend />
              <Area
                type="monotone"
                dataKey="registered"
                stroke="var(--color-primary)"
                fill="var(--color-primary)"
                fillOpacity={0.15}
              />
              <Area
                type="monotone"
                dataKey="completed"
                stroke="var(--color-success)"
                fill="var(--color-success)"
                fillOpacity={0.15}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bottlenecks by office</CardTitle>
          <CardDescription>Average hours a document waits before being forwarded.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="min-w-[40rem]" style={{ height: bottleneckChartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={turnaroundByOffice}
                layout="vertical"
                margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12 }}
                  stroke="var(--color-muted-foreground)"
                />
                <YAxis
                  dataKey="office"
                  type="category"
                  width={190}
                  interval={0}
                  tickFormatter={chartOfficeLabel}
                  tick={{ fontSize: 12 }}
                  stroke="var(--color-muted-foreground)"
                />
                <Tooltip contentStyle={{ borderRadius: 8, borderColor: "var(--color-border)" }} />
                <Bar dataKey="hours" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
