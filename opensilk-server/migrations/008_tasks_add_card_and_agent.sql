ALTER TABLE tasks ADD COLUMN card_id UUID REFERENCES cards(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_card_id ON tasks(card_id);
CREATE INDEX idx_tasks_agent_id ON tasks(agent_id);
