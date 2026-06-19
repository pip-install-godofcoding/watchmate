import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  try {
    const { record } = await req.json()
    if (!record?.conversation_id || !record?.sender_id) {
      return new Response('missing fields', { status: 400 })
    }

    // Get all members except the sender, with their push tokens
    const { data: members } = await supabase
      .from('conversation_members')
      .select('user_id, profiles ( display_name, expo_push_token )')
      .eq('conversation_id', record.conversation_id)
      .neq('user_id', record.sender_id)

    if (!members?.length) return new Response('no recipients')

    // Get sender name
    const { data: sender } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', record.sender_id)
      .single()

    const tokens = members
      .map((m: any) => m.profiles?.expo_push_token)
      .filter(Boolean)

    if (!tokens.length) return new Response('no tokens')

    // Send via Expo Push API (batched)
    const messages = tokens.map((token: string) => ({
      to: token,
      title: sender?.display_name ?? 'WatchMate',
      body: record.body ?? '📨 New message',
      data: { conversationId: record.conversation_id },
      sound: 'default',
    }))

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    })

    const result = await res.json()
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(String(e), { status: 500 })
  }
})
