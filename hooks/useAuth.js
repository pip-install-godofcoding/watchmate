import { useState, useEffect, createContext, useContext } from 'react'
import { Platform } from 'react-native'
import { supabase } from '../lib/supabase'
import { initRevenueCat } from '../lib/revenuecat'
import * as Notifications from 'expo-notifications'

// Show alerts when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

async function registerPushToken() {
  if (Platform.OS === 'web') return null
  try {
    const { status: existing } = await Notifications.getPermissionsAsync()
    let status = existing
    if (existing !== 'granted') {
      const { status: asked } = await Notifications.requestPermissionsAsync()
      status = asked
    }
    if (status !== 'granted') return null
    const { data: token } = await Notifications.getExpoPushTokenAsync()
    return token ?? null
  } catch {
    return null
  }
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setProfile(null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) {
      setProfile(data)
      initRevenueCat(userId)
      const pushToken = await registerPushToken()
      await supabase
        .from('profiles')
        .update({
          is_online: true,
          last_seen: new Date().toISOString(),
          ...(pushToken ? { expo_push_token: pushToken } : {}),
        })
        .eq('id', userId)
    }
  }

  const signUp = async ({ email, password, username, display_name }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, display_name } },
    })
    return { data, error }
  }

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  const signOut = async () => {
    if (user) {
      await supabase
        .from('profiles')
        .update({ is_online: false, last_seen: new Date().toISOString(), expo_push_token: null })
        .eq('id', user.id)
    }
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
