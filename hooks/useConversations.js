import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useConversations() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchConversations = async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('conversation_members')
      .select(`
        conversation_id,
        conversations (
          id, type, name, avatar_url, updated_at,
          conversation_members (
            user_id,
            profiles ( id, display_name, username, avatar_url, is_online )
          ),
          messages ( id, body, type, created_at, sender_id, profiles ( display_name ) )
        )
      `)
      .eq('user_id', user.id)

    if (!error && data) {
      const convs = data
        .map((d) => {
          const conv = d.conversations
          if (!conv) return null
          const sorted = (conv.messages || []).sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
          )
          conv.last_message = sorted[0] || null
          if (conv.type === 'dm') {
            const other = conv.conversation_members?.find((m) => m.user_id !== user.id)
            conv.dm_partner = other?.profiles
          }
          return conv
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      setConversations(convs)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!user) return
    fetchConversations()

    const channel = supabase
      .channel('conversations-mobile')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetchConversations)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'conversation_members',
        filter: `user_id=eq.${user.id}`,
      }, fetchConversations)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user])

  const createDM = async (targetUserId) => {
    const { data: existing } = await supabase.rpc('find_dm', {
      user_a: user.id,
      user_b: targetUserId,
    })
    if (existing) { await fetchConversations(); return existing }

    const { data: conv } = await supabase
      .from('conversations')
      .insert({ type: 'dm', created_by: user.id })
      .select()
      .single()

    await supabase.from('conversation_members').insert([
      { conversation_id: conv.id, user_id: user.id, role: 'admin' },
      { conversation_id: conv.id, user_id: targetUserId, role: 'member' },
    ])
    await fetchConversations()
    return conv
  }

  const createGroup = async (name, memberIds = []) => {
    const { data: conv, error } = await supabase
      .from('conversations')
      .insert({ type: 'group', name, created_by: user.id })
      .select()
      .single()

    if (error || !conv) return null

    const members = [user.id, ...memberIds].map((uid, i) => ({
      conversation_id: conv.id,
      user_id: uid,
      role: i === 0 ? 'admin' : 'member',
    }))
    await supabase.from('conversation_members').insert(members)
    await fetchConversations()
    return conv
  }

  return { conversations, loading, createDM, createGroup, refetch: fetchConversations }
}
