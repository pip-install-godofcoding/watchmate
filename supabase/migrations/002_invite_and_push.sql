-- Add push token column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expo_push_token text;

-- Allow users to update their own push token
DROP POLICY IF EXISTS "users update push token" ON profiles;
CREATE POLICY "users update push token" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Security definer function to add members to a conversation
-- bypasses RLS so admins can invite others
CREATE OR REPLACE FUNCTION add_members(conv_id uuid, member_ids uuid[])
RETURNS void AS $$
BEGIN
  INSERT INTO conversation_members (conversation_id, user_id, role)
  SELECT conv_id, unnest(member_ids), 'member'
  ON CONFLICT (conversation_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
