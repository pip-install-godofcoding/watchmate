import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../hooks/useAuth'
import C from '../constants/colors'

export default function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('signup')
  const [form, setForm] = useState({ email: '', password: '', username: '', display_name: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handle = async () => {
    setError(null)
    if (!form.email || !form.password) { setError('Email and password required'); return }
    if (mode === 'signup' && (!form.username || !form.display_name)) {
      setError('Username and display name required'); return
    }
    setLoading(true)
    const fn = mode === 'signup' ? signUp : signIn
    const { error } = await fn(form)
    if (error) setError(error.message)
    setLoading(false)
  }

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }))

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.logo}>
            <Text style={s.logoEmoji}>📺</Text>
          </View>
          <Text style={s.title}>WatchMate</Text>
          <Text style={s.subtitle}>
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </Text>

          <View style={s.card}>
            {mode === 'signup' && (
              <>
                <Text style={s.label}>Display name</Text>
                <TextInput
                  style={s.input}
                  placeholder="Your name"
                  placeholderTextColor={C.muted}
                  value={form.display_name}
                  onChangeText={set('display_name')}
                  autoCapitalize="words"
                />
                <Text style={s.label}>Username</Text>
                <TextInput
                  style={s.input}
                  placeholder="@username"
                  placeholderTextColor={C.muted}
                  value={form.username}
                  onChangeText={(v) => set('username')(v.toLowerCase())}
                  autoCapitalize="none"
                />
              </>
            )}
            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.input}
              placeholder="you@example.com"
              placeholderTextColor={C.muted}
              value={form.email}
              onChangeText={set('email')}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={s.label}>Password</Text>
            <TextInput
              style={s.input}
              placeholder="••••••••"
              placeholderTextColor={C.muted}
              value={form.password}
              onChangeText={set('password')}
              secureTextEntry
            />

            {error ? <Text style={s.error}>{error}</Text> : null}

            <TouchableOpacity style={s.btn} onPress={handle} disabled={loading} activeOpacity={0.8}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.btnText}>
                  {mode === 'signup' ? 'Create account' : 'Sign in'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setMode(m => m === 'signup' ? 'signin' : 'signup'); setError(null) }}>
              <Text style={s.toggle}>
                {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12,
  },
  logoEmoji: { fontSize: 28 },
  title: { fontSize: 24, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: C.textSec, textAlign: 'center', marginBottom: 24 },
  card: { backgroundColor: C.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.border },
  label: { fontSize: 12, color: C.textSec, marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: C.surface2, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    color: C.text, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
  },
  error: { color: C.error, fontSize: 12, marginTop: 8 },
  btn: {
    backgroundColor: C.accent, borderRadius: 12, paddingVertical: 13,
    alignItems: 'center', marginTop: 20,
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  toggle: { color: C.accent, fontSize: 13, textAlign: 'center', marginTop: 16 },
})
