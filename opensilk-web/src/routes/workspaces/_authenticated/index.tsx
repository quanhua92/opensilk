import { createFileRoute } from "@tanstack/react-router";
import { getWorkspaces, createWorkspace } from "@/features/workspaces/server-fns";
import { useWorkspaces, WorkspaceProvider } from "@/features/workspaces/context";
import WorkspaceCard from "@/features/workspaces/components/workspace-card";
import CreateWorkspaceDialog from "@/features/workspaces/components/create-workspace-dialog";

export const Route = createFileRoute("/workspaces/_authenticated/")({
  component: WorkspaceListPage,
  loader: async () => {
    return { workspaces: await getWorkspaces() };
  },
});

function WorkspaceListPage() {
  const { workspaces: initialWorkspaces } = Route.useLoaderData();

  return (
    <WorkspaceProvider initialWorkspaces={initialWorkspaces}>
      <WorkspaceListContent />
    </WorkspaceProvider>
  );
}

function WorkspaceListContent() {
  const { workspaces } = useWorkspaces();

  if (workspaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <h2 className="text-lg font-semibold">No workspaces yet</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Create a workspace to get started
        </p>
        <CreateWorkspaceDialog />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Workspaces</h1>
        <CreateWorkspaceDialog />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {workspaces.map((ws) => (
          <WorkspaceCard key={ws.id} workspace={ws} />
        ))}
      </div>
    </div>
  );
}
