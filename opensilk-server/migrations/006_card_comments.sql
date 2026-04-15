CREATE TABLE card_comments (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    author_type TEXT NOT NULL CHECK (author_type IN ('user', 'agent')),
    author_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_card_comments_card_id ON card_comments(card_id, created_at);
