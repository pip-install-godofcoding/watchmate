import { useState, useRef, useEffect } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../../hooks/useAuth'
import { useMessages } from '../../hooks/useMessages'
import C from '../../constants/colors'

export default function ChatScreen() {
  const router = useRouter()
  const { id, convName, convType } = useLocalSearchParams()
  const { user } = useAuth()
  const { messages, loading, sendMessage } = useMessages(id)
  const [text, setText] = useState('')
  const listRef = useRef(null)

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50)
    }
  }, [messages.length])

  const send = async () => {
    const val = text.trim()
    if (!val) return
    setText('')
    await sendMessage(val)
  }

  const renderMessage = ({ item: msg }) => {
    const isMine = msg.sender_id === user.id
    return (
      <View style={[s.msgRow, isMine ? s.msgRowMine : s.msgRowTheirs]}>
        {!isMine && (
          <View style={s.avatarSm}>
            <Text style={s.avatarSmText}>{msg.profiles?.display_name?.[0]?.toUpperCase()}</Text>
          </View>
        )}
        <View style={{ maxWidth: '75%' }}>
          {!isMine && (
            <Text style={s.senderName}>{msg.profiles?.display_name}</Text>
          )}
          <View style={[s.bubble, isMine ? s.bubbleMine : s.bubbleTheirs]}>
            <Text style={[s.bubbleText, isMine && { color: '#fff' }]}>{msg.body}</Text>
          </View>
          <Text style={[s.time, isMine && { textAlign: 'right' }]}>
            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <View style={s.avatarMd}>
          <Text style={s.avatarMdText}>{convName?.[0]?.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={s.headerName} numberOfLines={1}>{convName}</Text>
          <Text style={s.headerType}>{convType === 'dm' ? 'Direct message' : 'Group'}</Text>
        </View>
        <TouchableOpacity
          style={s.watchBtn}
          onPress={() => router.push({ pathname: `/watch/${id}`, params: { convName } })}
          activeOpacity={0.8}
        >
          <Text style={s.watchBtnText}>▶ Watch</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        {loading ? (
          <View style={s.center}>
            <Text style={{ color: C.muted }}>Loading…</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={{ padding: 12, flexGrow: 1 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={s.center}>
                <Text style={{ fontSize: 32 }}>👋</Text>
                <Text style={{ color: C.muted, marginTop: 8 }}>No messages yet. Say hi!</Text>
              </View>
            }
          />
        )}

        {/* Input */}
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            placeholder="Message…"
            placeholderTextColor={C.muted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={send}
          />
          <TouchableOpacity style={s.sendBtn} onPress={send} activeOpacity={0.8}>
            <Text style={s.sendBtnText}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { marginRight: 4, padding: 4 },
  backText: { fontSize: 22, color: C.text },
  avatarMd: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#3730a3',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarMdText: { color: '#c7d2fe', fontSize: 14, fontWeight: '700' },
  headerName: { fontSize: 14, fontWeight: '700', color: C.text },
  headerType: { fontSize: 11, color: C.muted },
  watchBtn: {
    backgroundColor: C.accentBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: C.accent + '60',
  },
  watchBtnText: { color: C.accent, fontSize: 12, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 3 },
  msgRowMine: { justifyContent: 'flex-end' },
  msgRowTheirs: { justifyContent: 'flex-start' },
  avatarSm: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#374151',
    alignItems: 'center', justifyContent: 'center', marginRight: 6,
  },
  avatarSmText: { color: C.textSec, fontSize: 11, fontWeight: '600' },
  senderName: { fontSize: 11, color: C.accent, marginBottom: 2, marginLeft: 2 },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMine: { backgroundColor: C.accent, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: C.surface2, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: C.border },
  bubbleText: { fontSize: 14, color: C.text, lineHeight: 20 },
  time: { fontSize: 10, color: C.muted, marginTop: 2, marginHorizontal: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: C.border, gap: 8,
  },
  input: {
    flex: 1, backgroundColor: C.surface2, borderRadius: 22, borderWidth: 1, borderColor: C.border,
    color: C.text, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnText: { color: '#fff', fontSize: 16 },
})
