import { Platform } from 'react-native'

// Replace with your actual RevenueCat API keys from revenuecat.com dashboard
const IOS_KEY = 'appl_REPLACE_WITH_YOUR_IOS_KEY'
const ANDROID_KEY = 'goog_REPLACE_WITH_YOUR_ANDROID_KEY'

let Purchases = null

async function loadPurchases() {
  if (Purchases) return Purchases
  try {
    const mod = await import('react-native-purchases')
    Purchases = mod.default
  } catch {
    // react-native-purchases not available in Expo Go — skip
  }
  return Purchases
}

export async function initRevenueCat(userId) {
  const P = await loadPurchases()
  if (!P) return
  const apiKey = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY
  await P.configure({ apiKey, appUserID: userId })
}

export async function hasPro() {
  const P = await loadPurchases()
  if (!P) return false
  try {
    const { customerInfo } = await P.getCustomerInfo()
    return 'pro' in customerInfo.entitlements.active
  } catch {
    return false
  }
}

export async function getOfferings() {
  const P = await loadPurchases()
  if (!P) return null
  try {
    const offerings = await P.getOfferings()
    return offerings.current
  } catch {
    return null
  }
}

export async function purchasePro() {
  const P = await loadPurchases()
  if (!P) throw new Error('Purchases not available')
  const current = await getOfferings()
  const pkg = current?.availablePackages?.[0]
  if (!pkg) throw new Error('No packages available')
  const { customerInfo } = await P.purchasePackage(pkg)
  return 'pro' in customerInfo.entitlements.active
}
