CREATE TABLE card_attachments (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT,
    content_type TEXT,
    uploaded_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_card_attachments_card_id ON card_attachments(card_id);
