export interface Agent {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  persona: string;
  avatar_url: string | null;
  enabled_tools: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateAgentRequest {
  name: string;
  slug: string;
  persona: string;
  avatar_url?: string;
  enabled_tools?: string[];
}

export interface UpdateAgentRequest {
  name?: string;
  persona?: string;
  avatar_url?: string;
  enabled_tools?: string[];
}
