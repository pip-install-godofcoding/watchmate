import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useWatchRoom(conversationId) {
  const { user } = useAuth()
  const [room, setRoom] = useState(null)
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const playerRef = useRef(null)
  const isSyncing = useRef(false)

  useEffect(() => {
    if (!conversationId) return

    const fetchRoom = async () => {
      const { data } = await supabase
        .from('watch_rooms')
        .select('*, watch_room_participants ( user_id, profiles ( display_name, avatar_url ) )')
        .eq('conversation_id', conversationId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setRoom(data)
      setParticipants(data?.watch_room_participants || [])
      setLoading(false)
    }

    fetchRoom()

    const channel = supabase
      .channel(`watchroom:${conversationId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'watch_rooms' },
        (payload) => {
          const updated = payload.new
          setRoom((prev) => ({ ...prev, ...updated }))
          if (updated.last_sync_by !== user.id && playerRef.current) {
            isSyncing.current = true
            playerRef.current.getCurrentTime().then((currentTime) => {
              const diff = Math.abs(currentTime - updated.seek_position)
              if (diff > 1.5) playerRef.current.seekTo(updated.seek_position, true)
            })
            setTimeout(() => { isSyncing.current = false }, 500)
          }
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watch_room_participants' }, fetchRoom)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [conversationId])

  const createRoom = async (url) => {
    const { data } = await supabase
      .from('watch_rooms')
      .insert({ conversation_id: conversationId, created_by: user.id, current_url: url, is_playing: false, seek_position: 0, is_active: true })
      .select()
      .single()
    await joinRoom(data.id)
    setRoom(data)
    return data
  }

  const joinRoom = async (roomId) => {
    await supabase
      .from('watch_room_participants')
      .upsert({ room_id: roomId, user_id: user.id }, { onConflict: 'room_id,user_id' })
  }

  const leaveRoom = async () => {
    if (!room) return
    await supabase
      .from('watch_room_participants')
      .delete()
      .match({ room_id: room.id, user_id: user.id })
    setRoom(null)
    setParticipants([])
  }

  const syncState = useCallback(async (updates) => {
    if (!room || isSyncing.current) return
    await supabase
      .from('watch_rooms')
      .update({ ...updates, last_sync_at: new Date().toISOString(), last_sync_by: user.id })
      .eq('id', room.id)
  }, [room, user])

  const changeUrl = async (newUrl) => {
    if (!room) return
    await supabase
      .from('watch_rooms')
      .update({ current_url: newUrl, seek_position: 0, is_playing: false })
      .eq('id', room.id)
  }

  return { room, participants, loading, createRoom, joinRoom, leaveRoom, syncState, changeUrl, playerRef }
}
