import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/workspaces/_authenticated/$workspaceId")({
  component: () => <Outlet />,
});
