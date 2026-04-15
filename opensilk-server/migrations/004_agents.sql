CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    persona TEXT NOT NULL DEFAULT '',
    avatar_url TEXT,
    enabled_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, slug)
);

CREATE INDEX idx_agents_workspace_id ON agents(workspace_id);
