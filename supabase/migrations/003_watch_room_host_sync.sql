-- Add host control and sync tracking to watch_rooms
ALTER TABLE watch_rooms
  ADD COLUMN IF NOT EXISTS host_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS sync_seq integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_sync_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz;

-- Backfill host_id from created_by for existing rooms
UPDATE watch_rooms SET host_id = created_by WHERE host_id IS NULL;
