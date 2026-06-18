import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, Dimensions,
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

function extractYtId(url) {
  const m = url?.match(/(?:v=|youtu\.be\/)([^&\s]+)/)
  return m ? m[1] : null
}

export default function WatchPartyScreen() {
  const router = useRouter()
  const { id, convName } = useLocalSearchParams()
  const { user } = useAuth()
  const { room, participants, loading, createRoom, joinRoom, leaveRoom, syncState, changeUrl, playerRef } =
    useWatchRoom(id)
  const { messages, sendMessage } = useMessages(id)
  const [urlInput, setUrlInput] = useState('')
  const [chatText, setChatText] = useState('')
  const [showChat, setShowChat] = useState(true)
  const [playing, setPlaying] = useState(false)
  const chatListRef = useRef(null)

  const alreadyIn = participants.some((p) => p.user_id === user?.id)

  const handleCreate = async () => {
    if (!urlInput.trim()) return
    await createRoom(urlInput.trim())
    setUrlInput('')
  }

  const handleChangeUrl = async () => {
    if (!urlInput.trim()) return
    await changeUrl(urlInput.trim())
    setUrlInput('')
  }

  const sendChat = async () => {
    const val = chatText.trim()
    if (!val) return
    setChatText('')
    await sendMessage(val)
  }

  const onStateChange = (state) => {
    if (state === 'playing') {
      setPlaying(true)
      playerRef.current?.getCurrentTime().then((t) => syncState({ is_playing: true, seek_position: t }))
    } else if (state === 'paused') {
      setPlaying(false)
      playerRef.current?.getCurrentTime().then((t) => syncState({ is_playing: false, seek_position: t }))
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={s.headerTitle}>Watch Party</Text>
          {room && <Text style={s.headerSub}>● {participants.length} watching</Text>}
        </View>
        {room && alreadyIn && (
          <TouchableOpacity onPress={leaveRoom} hitSlop={8}>
            <Text style={{ color: C.error, fontSize: 13 }}>Leave</Text>
          </TouchableOpacity>
        )}
      </View>

      {!room ? (
        /* ── No room yet ── */
        <View style={s.emptyWrap}>
          <Text style={{ fontSize: 56 }}>🎬</Text>
          <Text style={s.emptyTitle}>Start a watch party</Text>
          <Text style={s.emptyDesc}>
            Paste a YouTube URL — everyone in "{convName}" can join and watch in sync
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
        /* ── Active room ── */
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Player */}
          <View style={{ backgroundColor: '#000' }}>
            {extractYtId(room.current_url) ? (
              <YoutubeIframe
                ref={playerRef}
                height={PLAYER_HEIGHT}
                width={width}
                videoId={extractYtId(room.current_url)}
                play={playing}
                onChangeState={onStateChange}
              />
            ) : (
              <View style={[{ height: PLAYER_HEIGHT, width }, s.noVideo]}>
                <Text style={{ color: C.muted }}>Invalid YouTube URL</Text>
              </View>
            )}
          </View>

          {/* URL change bar */}
          <View style={s.changeBar}>
            <TextInput
              style={s.changeInput}
              placeholder="Change video URL…"
              placeholderTextColor={C.muted}
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
            />
            <TouchableOpacity style={s.loadBtn} onPress={handleChangeUrl}>
              <Text style={s.loadBtnText}>Load</Text>
            </TouchableOpacity>
          </View>

          {/* Participants */}
          <View style={s.participantsBar}>
            <Text style={s.watchingLabel}>Watching: </Text>
            {participants.map((p) => (
              <View key={p.user_id} style={s.participantChip}>
                <Text style={s.participantText}>{p.profiles?.display_name?.[0]?.toUpperCase()}</Text>
              </View>
            ))}
            {!alreadyIn && (
              <TouchableOpacity onPress={() => joinRoom(room.id)}>
                <Text style={{ color: C.accent, fontSize: 13, marginLeft: 6 }}>+ Join</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.chatToggle} onPress={() => setShowChat((v) => !v)}>
              <Text style={s.chatToggleText}>{showChat ? '💬 Hide chat' : '💬 Chat'}</Text>
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
  changeBar: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  changeInput: {
    flex: 1, backgroundColor: C.surface2, borderRadius: 8, borderWidth: 1, borderColor: C.border,
    color: C.text, paddingHorizontal: 12, paddingVertical: 7, fontSize: 13,
  },
  loadBtn: { backgroundColor: C.accent, borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
  loadBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  participantsBar: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, gap: 4,
  },
  watchingLabel: { fontSize: 12, color: C.muted },
  participantChip: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#3730a3',
    alignItems: 'center', justifyContent: 'center',
  },
  participantText: { color: '#c7d2fe', fontSize: 11, fontWeight: '700' },
  chatToggle: { marginLeft: 'auto' },
  chatToggleText: { color: C.accent, fontSize: 12 },
  chat: { flex: 1, backgroundColor: C.bg },
  chatMsg: { fontSize: 13, color: C.textSec, marginVertical: 2, lineHeight: 18 },
  chatSender: { color: C.accent, fontWeight: '600' },
  chatInput: {
    flexDirection: 'row', gap: 8, padding: 10,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  chatTextInput: {
    flex: 1, backgroundColor: C.surface2, borderRadius: 16, borderWidth: 1, borderColor: C.border,
    color: C.text, paddingHorizontal: 14, paddingVertical: 8, fontSize: 13,
  },
  chatSendBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
  },
})
