import { Clock, Play, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Task } from "../types";

interface OverviewStatsProps {
  tasks: Task[];
}

export default function OverviewStats({ tasks }: OverviewStatsProps) {
  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const runningCount = tasks.filter((t) => t.status === "running").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const failedCount = tasks.filter((t) => t.status === "failed").length;

  const stats = [
    { title: "Pending", value: pendingCount, icon: Clock, variant: "outline" as const },
    { title: "Running", value: runningCount, icon: Play, variant: "default" as const },
    { title: "Completed", value: completedCount, icon: CheckCircle, variant: "default" as const },
    { title: "Failed", value: failedCount, icon: XCircle, variant: "destructive" as const },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {stat.title}
            </CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
