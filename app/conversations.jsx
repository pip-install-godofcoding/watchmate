import { useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, Modal, Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuth } from '../hooks/useAuth'
import { useConversations } from '../hooks/useConversations'
import { supabase } from '../lib/supabase'
import C from '../constants/colors'

export default function ConversationsScreen() {
  const router = useRouter()
  const { profile, signOut } = useAuth()
  const { conversations, loading, createDM, createGroup } = useConversations()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [userResults, setUserResults] = useState([])
  const [groupModal, setGroupModal] = useState(false)
  const [groupName, setGroupName] = useState('')

  const searchUsers = async (q) => {
    setSearch(q)
    if (!q.trim()) { setUserResults([]); return }
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, username, is_online')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(6)
    setUserResults(data || [])
  }

  const handleDM = async (userId) => {
    setSearch('')
    setUserResults([])
    const conv = await createDM(userId)
    router.push({ pathname: `/chat/${conv.id}`, params: { convType: 'dm' } })
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return
    const conv = await createGroup(groupName.trim(), [])
    setGroupModal(false)
    setGroupName('')
    router.push({ pathname: `/chat/${conv.id}`, params: { convType: 'group', convName: groupName.trim() } })
  }

  const filtered = conversations
    .filter((c) => {
      const name = c.type === 'dm' ? c.dm_partner?.display_name : c.name
      return !search.trim() || name?.toLowerCase().includes(search.toLowerCase())
    })
    .filter((c) => tab === 'all' || c.type === tab)

  const renderItem = useCallback(({ item: conv }) => {
    const name = conv.type === 'dm' ? conv.dm_partner?.display_name : conv.name
    const isOnline = conv.type === 'dm' && conv.dm_partner?.is_online
    const lastMsg = conv.last_message
    return (
      <TouchableOpacity
        style={s.convItem}
        activeOpacity={0.7}
        onPress={() => router.push({
          pathname: `/chat/${conv.id}`,
          params: { convType: conv.type, convName: name },
        })}
      >
        <View>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{name?.[0]?.toUpperCase()}</Text>
          </View>
          {isOnline && <View style={s.onlineDot} />}
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.convName} numberOfLines={1}>{name}</Text>
          <Text style={s.convLast} numberOfLines={1}>
            {lastMsg ? (lastMsg.body || '📎 Attachment') : 'No messages yet'}
          </Text>
        </View>
        {lastMsg && (
          <Text style={s.convTime}>
            {new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </TouchableOpacity>
    )
  }, [])

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={s.logo}><Text style={{ fontSize: 16 }}>📺</Text></View>
          <Text style={s.headerTitle}>WatchMate</Text>
        </View>
        <TouchableOpacity onPress={() => setGroupModal(true)} hitSlop={8}>
          <Text style={s.newBtn}>✏️</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <TextInput
          style={s.searchInput}
          placeholder="Search or find users…"
          placeholderTextColor={C.muted}
          value={search}
          onChangeText={searchUsers}
        />
      </View>

      {/* User search results */}
      {userResults.length > 0 && (
        <View style={s.userResults}>
          {userResults.map((u) => (
            <TouchableOpacity key={u.id} style={s.userResult} onPress={() => handleDM(u.id)} activeOpacity={0.7}>
              <View style={s.avatarSm}>
                <Text style={s.avatarSmText}>{u.display_name[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={s.userName}>{u.display_name}</Text>
                <Text style={s.userHandle}>@{u.username}</Text>
              </View>
              <View style={[s.dot, { backgroundColor: u.is_online ? C.online : C.border }]} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Tabs */}
      <View style={s.tabs}>
        {['all', 'dm', 'group'].map((t) => (
          <TouchableOpacity key={t} style={s.tab} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabActive]}>
              {t === 'all' ? 'All' : t === 'dm' ? 'DMs' : 'Groups'}
            </Text>
            {tab === t && <View style={s.tabBar} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ flexGrow: 1 }}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ fontSize: 36 }}>💬</Text>
              <Text style={[s.convLast, { marginTop: 8, textAlign: 'center' }]}>
                {search ? 'No matches' : 'No conversations yet.\nSearch for a user above.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Me footer */}
      <View style={s.footer}>
        <View style={s.footerAvatar}>
          <Text style={s.avatarText}>{profile?.display_name?.[0]?.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={s.convName}>{profile?.display_name}</Text>
          <Text style={{ fontSize: 11, color: C.online }}>● Online</Text>
        </View>
        <TouchableOpacity onPress={signOut} hitSlop={8}>
          <Text style={{ color: C.error, fontSize: 13 }}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* New Group Modal */}
      <Modal visible={groupModal} transparent animationType="fade">
        <Pressable style={s.modalOverlay} onPress={() => setGroupModal(false)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={s.modalTitle}>New Group</Text>
            <TextInput
              style={s.input}
              placeholder="Group name…"
              placeholderTextColor={C.muted}
              value={groupName}
              onChangeText={setGroupName}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: C.surface2 }]} onPress={() => setGroupModal(false)}>
                <Text style={{ color: C.textSec, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: C.accent, flex: 1 }]} onPress={handleCreateGroup}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Create</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  logo: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  newBtn: { fontSize: 20 },
  searchWrap: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  searchInput: {
    backgroundColor: C.surface2, borderRadius: 20, borderWidth: 1, borderColor: C.border,
    color: C.text, paddingHorizontal: 16, paddingVertical: 8, fontSize: 14,
  },
  userResults: { borderBottomWidth: 1, borderBottomColor: C.border },
  userResult: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  avatarSm: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#3730a3',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarSmText: { color: '#c7d2fe', fontSize: 13, fontWeight: '600' },
  userName: { fontSize: 13, fontWeight: '600', color: C.text },
  userHandle: { fontSize: 11, color: C.muted },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabText: { fontSize: 13, color: C.muted },
  tabActive: { color: C.accent, fontWeight: '600' },
  tabBar: { position: 'absolute', bottom: 0, height: 2, width: '60%', backgroundColor: C.accent, borderRadius: 1 },
  convItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border + '80',
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#3730a3',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#c7d2fe', fontSize: 16, fontWeight: '700' },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6, backgroundColor: C.online,
    borderWidth: 2, borderColor: C.bg,
  },
  convName: { fontSize: 14, fontWeight: '600', color: C.text },
  convLast: { fontSize: 12, color: C.muted, marginTop: 2 },
  convTime: { fontSize: 11, color: C.muted },
  footer: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  footerAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#4338ca',
    alignItems: 'center', justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: C.surface, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: C.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 12 },
  input: {
    backgroundColor: C.surface2, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    color: C.text, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
  },
  modalBtn: {
    paddingVertical: 12, borderRadius: 10, alignItems: 'center', paddingHorizontal: 20,
  },
})
