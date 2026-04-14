import { useNavigate } from "@tanstack/react-router";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Workspace } from "../types";

interface WorkspaceCardProps {
  workspace: Workspace;
}

export default function WorkspaceCard({ workspace }: WorkspaceCardProps) {
  const navigate = useNavigate();

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() =>
        navigate({ to: `/workspaces/${workspace.id}` })
      }
    >
      <CardHeader>
        <CardTitle className="text-lg">{workspace.name}</CardTitle>
        <CardDescription>
          Created{" "}
          {new Date(workspace.created_at).toLocaleDateString()}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
