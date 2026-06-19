import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, Dimensions,
  Alert, ActivityIndicator, Image, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import YoutubeIframe from 'react-native-youtube-iframe'
import { useWatchRoom } from '../../hooks/useWatchRoom'
import { useMessages } from '../../hooks/useMessages'
import { useAuth } from '../../hooks/useAuth'
import C from '../../constants/colors'

const { width } = Dimensions.get('window')
const PLAYER_HEIGHT = Math.round(width * 9 / 16)
const YT_KEY = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY

function extractYtId(url) {
  const m = url?.match(/(?:v=|youtu\.be\/)([^&\s]+)/)
  return m ? m[1] : null
}

async function searchYouTube(query) {
  if (!YT_KEY) return []
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&key=${YT_KEY}&maxResults=8`
    )
    const data = await res.json()
    return (data.items || []).map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumb: item.snippet.thumbnails?.default?.url,
    }))
  } catch {
    return []
  }
}

export default function WatchPartyScreen() {
  const router = useRouter()
  const { id, convName } = useLocalSearchParams()
  const { user } = useAuth()
  const {
    room, participants, loading, isHost,
    createRoom, joinRoom, leaveRoom, syncState, changeUrl, transferHost, playerRef,
  } = useWatchRoom(id)
  const { messages, sendMessage } = useMessages(id)

  const [localPlaying, setLocalPlaying] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [searchMode, setSearchMode] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [chatText, setChatText] = useState('')
  const [showChat, setShowChat] = useState(true)
  const chatListRef = useRef(null)
  const searchTimer = useRef(null)

  const alreadyIn = participants.some((p) => p.user_id === user?.id)

  // Seek to room position when first joining as a viewer
  useEffect(() => {
    if (!room || !playerRef.current || isHost) return
    const t = setTimeout(() => {
      playerRef.current?.seekTo(room.seek_position || 0, true)
    }, 1500)
    return () => clearTimeout(t)
  }, [room?.id])

  const handleCreate = async () => {
    if (!urlInput.trim()) return
    await createRoom(urlInput.trim())
    setUrlInput('')
  }

  const handleLoadUrl = async () => {
    if (!urlInput.trim() || !isHost) return
    setLocalPlaying(false)
    await changeUrl(urlInput.trim())
    setUrlInput('')
    setSearchResults([])
  }

  const handleSearchInput = (text) => {
    setUrlInput(text)
    if (!searchMode) return
    clearTimeout(searchTimer.current)
    if (!text.trim()) { setSearchResults([]); return }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      const results = await searchYouTube(text)
      setSearchResults(results)
      setSearching(false)
    }, 600)
  }

  const handleSelectVideo = async (videoId) => {
    setLocalPlaying(false)
    await changeUrl(`https://www.youtube.com/watch?v=${videoId}`)
    setUrlInput('')
    setSearchResults([])
  }

  const handleStateChange = async (state) => {
    if (!isHost) return
    if (state === 'playing') {
      setLocalPlaying(true)
      try {
        const t = await playerRef.current?.getCurrentTime()
        await syncState({ is_playing: true, seek_position: t ?? 0 })
      } catch {}
    } else if (state === 'paused') {
      setLocalPlaying(false)
      try {
        const t = await playerRef.current?.getCurrentTime()
        await syncState({ is_playing: false, seek_position: t ?? 0 })
      } catch {}
    }
  }

  const handleParticipantPress = (p) => {
    if (!isHost || p.user_id === user?.id) return
    const name = p.profiles?.display_name || 'this user'
    Alert.alert('Transfer Host', `Make ${name} the host?\nThey will control playback for everyone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Make Host', onPress: () => transferHost(p.user_id) },
    ])
  }

  const sendChat = async () => {
    const val = chatText.trim()
    if (!val) return
    setChatText('')
    await sendMessage(val)
  }

  // Non-hosts follow room state; host controls locally
  const play = isHost ? localPlaying : (room?.is_playing ?? false)

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={s.headerTitle}>{convName || 'Watch Party'}</Text>
          {room && <Text style={s.headerSub}>● {participants.length} watching</Text>}
        </View>
        {isHost && <Text style={s.hostBadge}>👑 Host</Text>}
        {!isHost && room && <Text style={s.viewerBadge}>👁 Viewer</Text>}
        {room && alreadyIn && (
          <TouchableOpacity onPress={leaveRoom} hitSlop={8} style={{ marginLeft: 8 }}>
            <Text style={{ color: C.error, fontSize: 13 }}>Leave</Text>
          </TouchableOpacity>
        )}
      </View>

      {!room ? (
        <View style={s.emptyWrap}>
          <Text style={{ fontSize: 56 }}>🎬</Text>
          <Text style={s.emptyTitle}>Start a watch party</Text>
          <Text style={s.emptyDesc}>
            Paste a YouTube URL — everyone in "{convName}" watches in sync
          </Text>
          <View style={s.urlRow}>
            <TextInput
              style={s.urlInput}
              placeholder="https://youtube.com/watch?v=…"
              placeholderTextColor={C.muted}
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              keyboardType="url"
            />
            <TouchableOpacity style={s.startBtn} onPress={handleCreate} activeOpacity={0.8}>
              <Text style={s.startBtnText}>Start</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Player */}
          <View style={{ backgroundColor: '#000' }}>
            {extractYtId(room.current_url) ? (
              <View>
                <YoutubeIframe
                  ref={playerRef}
                  height={PLAYER_HEIGHT}
                  width={width}
                  videoId={extractYtId(room.current_url)}
                  play={play}
                  onChangeState={handleStateChange}
                />
                {/* Transparent overlay blocks non-host touch on the player */}
                {!isHost && (
                  <View style={[StyleSheet.absoluteFill, s.viewerOverlay]} pointerEvents="box-only" />
                )}
              </View>
            ) : (
              <View style={[{ height: PLAYER_HEIGHT, width }, s.noVideo]}>
                <Text style={{ color: C.muted }}>Invalid YouTube URL</Text>
              </View>
            )}
          </View>

          {/* Host-only controls */}
          {isHost && (
            <View>
              <View style={s.modeRow}>
                <TouchableOpacity
                  style={[s.modeBtn, !searchMode && s.modeBtnActive]}
                  onPress={() => { setSearchMode(false); setSearchResults([]) }}
                >
                  <Text style={[s.modeBtnText, !searchMode && s.modeBtnTextActive]}>🔗 URL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modeBtn, searchMode && s.modeBtnActive]}
                  onPress={() => setSearchMode(true)}
                >
                  <Text style={[s.modeBtnText, searchMode && s.modeBtnTextActive]}>🔍 Search</Text>
                </TouchableOpacity>
                {searchMode && !YT_KEY && (
                  <Text style={s.noKeyNote}>Add EXPO_PUBLIC_YOUTUBE_API_KEY to .env</Text>
                )}
              </View>
              <View style={s.changeBar}>
                <TextInput
                  style={s.changeInput}
                  placeholder={searchMode ? 'Search YouTube…' : 'Paste YouTube URL…'}
                  placeholderTextColor={C.muted}
                  value={urlInput}
                  onChangeText={handleSearchInput}
                  autoCapitalize="none"
                  returnKeyType={searchMode ? 'search' : 'done'}
                  onSubmitEditing={searchMode ? undefined : handleLoadUrl}
                />
                {!searchMode && (
                  <TouchableOpacity style={s.loadBtn} onPress={handleLoadUrl}>
                    <Text style={s.loadBtnText}>Load</Text>
                  </TouchableOpacity>
                )}
                {searching && <ActivityIndicator size="small" color={C.accent} style={{ marginLeft: 6 }} />}
              </View>

              {/* Search results */}
              {searchResults.length > 0 && (
                <ScrollView style={s.searchResults} keyboardShouldPersistTaps="handled">
                  {searchResults.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={s.searchResult}
                      onPress={() => handleSelectVideo(item.id)}
                      activeOpacity={0.7}
                    >
                      {item.thumb ? (
                        <Image source={{ uri: item.thumb }} style={s.thumb} />
                      ) : (
                        <View style={[s.thumb, s.thumbPlaceholder]}>
                          <Text style={{ color: C.muted }}>▶</Text>
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={s.resultTitle} numberOfLines={2}>{item.title}</Text>
                        <Text style={s.resultChannel} numberOfLines={1}>{item.channel}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Participants bar */}
          <View style={s.participantsBar}>
            <Text style={s.watchingLabel}>Watching: </Text>
            {participants.map((p) => {
              const isParticipantHost = p.user_id === (room?.host_id || room?.created_by)
              return (
                <TouchableOpacity
                  key={p.user_id}
                  style={[s.participantChip, isParticipantHost && s.hostChip]}
                  onPress={() => handleParticipantPress(p)}
                  activeOpacity={isHost && p.user_id !== user?.id ? 0.7 : 1}
                >
                  <Text style={s.participantText}>
                    {isParticipantHost ? '👑' : p.profiles?.display_name?.[0]?.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              )
            })}
            {!alreadyIn && (
              <TouchableOpacity onPress={() => joinRoom(room.id)}>
                <Text style={{ color: C.accent, fontSize: 13, marginLeft: 6 }}>+ Join</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.chatToggle} onPress={() => setShowChat((v) => !v)}>
              <Text style={s.chatToggleText}>{showChat ? '💬 Hide' : '💬 Chat'}</Text>
            </TouchableOpacity>
          </View>

          {/* Chat */}
          {showChat && (
            <View style={s.chat}>
              <FlatList
                ref={chatListRef}
                data={messages}
                keyExtractor={(m) => m.id}
                renderItem={({ item: msg }) => (
                  <Text style={s.chatMsg}>
                    <Text style={s.chatSender}>{msg.profiles?.display_name}: </Text>
                    {msg.body}
                  </Text>
                )}
                onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: false })}
                contentContainerStyle={{ padding: 10 }}
              />
              <View style={s.chatInput}>
                <TextInput
                  style={s.chatTextInput}
                  placeholder="React…"
                  placeholderTextColor={C.muted}
                  value={chatText}
                  onChangeText={setChatText}
                  returnKeyType="send"
                  onSubmitEditing={sendChat}
                />
                <TouchableOpacity style={s.chatSendBtn} onPress={sendChat}>
                  <Text style={{ color: '#fff', fontSize: 14 }}>➤</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  back: { fontSize: 22, color: C.text },
  headerTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  headerSub: { fontSize: 11, color: C.online },
  hostBadge: { fontSize: 12, color: '#fbbf24', fontWeight: '600' },
  viewerBadge: { fontSize: 12, color: C.muted },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: C.text, marginTop: 12 },
  emptyDesc: { fontSize: 14, color: C.muted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  urlRow: { flexDirection: 'row', gap: 8, marginTop: 24, width: '100%' },
  urlInput: {
    flex: 1, backgroundColor: C.surface2, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    color: C.text, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13,
  },
  startBtn: { backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  noVideo: { alignItems: 'center', justifyContent: 'center' },
  viewerOverlay: { backgroundColor: 'transparent' },
  modeRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 6, gap: 6,
    backgroundColor: C.surface,
  },
  modeBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  modeBtnActive: { backgroundColor: C.accent, borderColor: C.accent },
  modeBtnText: { fontSize: 12, color: C.muted },
  modeBtnTextActive: { color: '#fff', fontWeight: '600' },
  noKeyNote: { fontSize: 10, color: C.error, flex: 1, textAlign: 'right' },
  changeBar: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, alignItems: 'center',
  },
  changeInput: {
    flex: 1, backgroundColor: C.surface2, borderRadius: 8, borderWidth: 1, borderColor: C.border,
    color: C.text, paddingHorizontal: 12, paddingVertical: 7, fontSize: 13,
  },
  loadBtn: { backgroundColor: C.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  loadBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  searchResults: { backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, maxHeight: 260 },
  searchResult: {
    flexDirection: 'row', alignItems: 'center', padding: 8,
    borderBottomWidth: 1, borderBottomColor: C.border + '40',
  },
  thumb: { width: 80, height: 45, borderRadius: 4 },
  thumbPlaceholder: { backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 12, color: C.text, lineHeight: 16 },
  resultChannel: { fontSize: 11, color: C.muted, marginTop: 2 },
  participantsBar: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, gap: 4,
  },
  watchingLabel: { fontSize: 12, color: C.muted },
  participantChip: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#3730a3',
    alignItems: 'center', justifyContent: 'center',
  },
  hostChip: { backgroundColor: '#78350f' },
  participantText: { color: '#c7d2fe', fontSize: 11, fontWeight: '700' },
  chatToggle: { marginLeft: 'auto' },
  chatToggleText: { color: C.accent, fontSize: 12 },
  chat: { flex: 1, backgroundColor: C.bg },
  chatMsg: { fontSize: 13, color: C.textSec, marginVertical: 2, lineHeight: 18 },
  chatSender: { color: C.accent, fontWeight: '600' },
  chatInput: { flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: C.border },
  chatTextInput: {
    flex: 1, backgroundColor: C.surface2, borderRadius: 16, borderWidth: 1, borderColor: C.border,
    color: C.text, paddingHorizontal: 14, paddingVertical: 8, fontSize: 13,
  },
  chatSendBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
  },
})
