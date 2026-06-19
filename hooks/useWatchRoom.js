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
  const syncSeqRef = useRef(0)

  const isHost = !!(room && user && (room.host_id ? room.host_id === user.id : room.created_by === user.id))

  const fetchRoom = useCallback(async () => {
    const { data } = await supabase
      .from('watch_rooms')
      .select('*, watch_room_participants ( user_id, profiles ( display_name, avatar_url ) )')
      .eq('conversation_id', conversationId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setRoom(data)
    if (data) syncSeqRef.current = data.sync_seq ?? 0
    setParticipants(data?.watch_room_participants || [])
    setLoading(false)
  }, [conversationId])

  useEffect(() => {
    if (!conversationId) return
    fetchRoom()

    const channel = supabase
      .channel(`watchroom:${conversationId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'watch_rooms' },
        async (payload) => {
          const updated = payload.new
          const incomingSeq = updated.sync_seq ?? 0
          // Race condition guard: ignore stale out-of-order updates
          if (incomingSeq < syncSeqRef.current) return
          syncSeqRef.current = incomingSeq
          setRoom((prev) => ({ ...prev, ...updated }))
          // Apply seek/play changes from remote (not from ourselves)
          if (updated.last_sync_by !== user?.id && playerRef.current) {
            isSyncing.current = true
            try {
              const t = await playerRef.current.getCurrentTime()
              if (Math.abs(t - updated.seek_position) > 1.5) {
                playerRef.current.seekTo(updated.seek_position, true)
              }
            } catch {}
            setTimeout(() => { isSyncing.current = false }, 600)
          }
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watch_room_participants' }, fetchRoom)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [conversationId])

  // Host broadcasts position every 8s to keep late joiners in sync
  useEffect(() => {
    if (!isHost || !room?.is_playing || !room?.id) return
    const interval = setInterval(async () => {
      if (!isSyncing.current && playerRef.current) {
        try {
          const t = await playerRef.current.getCurrentTime()
          const newSeq = syncSeqRef.current + 1
          syncSeqRef.current = newSeq
          await supabase.from('watch_rooms').update({
            seek_position: t,
            last_sync_at: new Date().toISOString(),
            last_sync_by: user.id,
            sync_seq: newSeq,
          }).eq('id', room.id)
        } catch {}
      }
    }, 8000)
    return () => clearInterval(interval)
  }, [isHost, room?.is_playing, room?.id])

  const syncState = useCallback(async (updates) => {
    if (!room || isSyncing.current) return
    const newSeq = syncSeqRef.current + 1
    syncSeqRef.current = newSeq
    await supabase.from('watch_rooms').update({
      ...updates,
      last_sync_at: new Date().toISOString(),
      last_sync_by: user.id,
      sync_seq: newSeq,
    }).eq('id', room.id)
  }, [room, user])

  const createRoom = async (url) => {
    const { data } = await supabase
      .from('watch_rooms')
      .insert({
        conversation_id: conversationId,
        created_by: user.id,
        host_id: user.id,
        current_url: url,
        is_playing: false,
        seek_position: 0,
        is_active: true,
        sync_seq: 0,
      })
      .select()
      .single()
    if (!data) return null
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
    await supabase.from('watch_room_participants').delete().match({ room_id: room.id, user_id: user.id })
    setRoom(null)
    setParticipants([])
  }

  const changeUrl = async (newUrl) => {
    if (!room) return
    const newSeq = syncSeqRef.current + 1
    syncSeqRef.current = newSeq
    await supabase.from('watch_rooms').update({
      current_url: newUrl,
      seek_position: 0,
      is_playing: false,
      sync_seq: newSeq,
      last_sync_by: user.id,
      last_sync_at: new Date().toISOString(),
    }).eq('id', room.id)
  }

  const transferHost = async (newHostId) => {
    if (!room || !isHost) return
    await supabase.from('watch_rooms').update({ host_id: newHostId }).eq('id', room.id)
  }

  return {
    room, participants, loading, isHost,
    createRoom, joinRoom, leaveRoom, syncState, changeUrl, transferHost, playerRef,
  }
}
