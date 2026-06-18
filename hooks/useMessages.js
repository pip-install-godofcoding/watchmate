import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useMessages(conversationId) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const listRef = useRef(null)

  useEffect(() => {
    if (!conversationId) return
    setLoading(true)
    setMessages([])

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, profiles ( id, display_name, username, avatar_url )')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(100)
      setMessages(data || [])
      setLoading(false)
    }

    fetchMessages()

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('messages')
          .select('*, profiles ( id, display_name, username, avatar_url )')
          .eq('id', payload.new.id)
          .single()
        if (data) setMessages((prev) => [...prev, data])
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages((prev) => prev.filter((m) => m.id !== payload.old.id))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [conversationId])

  const sendMessage = async (body, type = 'text') => {
    if (!body?.trim()) return
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: body.trim(),
      type,
    })
  }

  const deleteMessage = async (messageId) => {
    await supabase.from('messages').delete().eq('id', messageId)
  }

  return { messages, loading, sendMessage, deleteMessage, listRef }
}
