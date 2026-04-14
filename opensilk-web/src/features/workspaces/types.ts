export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkspaceRequest {
  name: string;
}
