CREATE TABLE boards (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    column_config JSONB NOT NULL DEFAULT '["inbox","planning","ready","in_progress","review","done"]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cards (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'inbox'
        CHECK (status IN ('inbox','planning','ready','in_progress','review','done')),
    assigned_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    priority TEXT NOT NULL DEFAULT 'none'
        CHECK (priority IN ('none','low','medium','high','urgent')),
    context_summary TEXT,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE card_agents (
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member'
        CHECK (role IN ('manager','member','reviewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (card_id, agent_id)
);

CREATE INDEX idx_boards_workspace_id ON boards(workspace_id);
CREATE INDEX idx_cards_board_status ON cards(board_id, status);
CREATE INDEX idx_cards_workspace_id ON cards(workspace_id);
CREATE INDEX idx_cards_assigned_agent ON cards(assigned_agent_id);
CREATE INDEX idx_card_agents_card_id ON card_agents(card_id);
CREATE INDEX idx_card_agents_agent_id ON card_agents(agent_id);
