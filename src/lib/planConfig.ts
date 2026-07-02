export interface PlanConfig {
  displayName: string
  priceUsd: number
  dailyCredits: number
  signupCredits: number
  adFrequencyHours: number | null
  partnershipRequired: boolean
}

export const PLAN_CONFIG: Record<string, PlanConfig> = {
  free:       { displayName: 'Free',       priceUsd: 0,      dailyCredits: 0,    signupCredits: 5, adFrequencyHours: 6,    partnershipRequired: false },
  starter:    { displayName: 'Starter',    priceUsd: 4.99,   dailyCredits: 5,    signupCredits: 0, adFrequencyHours: 12,   partnershipRequired: false },
  pro:        { displayName: 'Pro',        priceUsd: 19.99,  dailyCredits: 5,    signupCredits: 0, adFrequencyHours: 24,   partnershipRequired: false },
  premium_1:  { displayName: 'Premium 1',  priceUsd: 49.99,  dailyCredits: 5,    signupCredits: 0, adFrequencyHours: 168,  partnershipRequired: false },
  premium_2:  { displayName: 'Premium 2',  priceUsd: 79.99,  dailyCredits: 5,    signupCredits: 0, adFrequencyHours: 168,  partnershipRequired: false },
  business_1: { displayName: 'Business 1', priceUsd: 99.99,  dailyCredits: 12,   signupCredits: 0, adFrequencyHours: null, partnershipRequired: true  },
  business_2: { displayName: 'Business 2', priceUsd: 199.99, dailyCredits: 50,   signupCredits: 0, adFrequencyHours: null, partnershipRequired: true  },
  business_3: { displayName: 'Business 3', priceUsd: 299.99, dailyCredits: 200,  signupCredits: 0, adFrequencyHours: null, partnershipRequired: true  },
  business_4: { displayName: 'Business 4', priceUsd: 399.99, dailyCredits: 400,  signupCredits: 0, adFrequencyHours: null, partnershipRequired: true  },
  business_5: { displayName: 'Business 5', priceUsd: 499.99, dailyCredits: 600,  signupCredits: 0, adFrequencyHours: null, partnershipRequired: true  },
  business_6: { displayName: 'Business 6', priceUsd: 599.99, dailyCredits: 800,  signupCredits: 0, adFrequencyHours: null, partnershipRequired: true  },
  business_7: { displayName: 'Business 7', priceUsd: 699.99, dailyCredits: 1000, signupCredits: 0, adFrequencyHours: null, partnershipRequired: true  },
  enterprise: { displayName: 'Enterprise', priceUsd: 0,      dailyCredits: 1200, signupCredits: 0, adFrequencyHours: null, partnershipRequired: true  },
  beta:       { displayName: 'Beta',       priceUsd: 0,      dailyCredits: 5,    signupCredits: 0, adFrequencyHours: null, partnershipRequired: false },
}

export const BUSINESS_TIERS = ['business_1','business_2','business_3','business_4','business_5','business_6','business_7','enterprise']

export function getPlanConfig(plan: string): PlanConfig {
  return PLAN_CONFIG[plan] ?? PLAN_CONFIG['free']
}

export function shouldShowAd(params: { plan: string; partnershipSigned: boolean; lastShownAt: Date | null }): boolean {
  const { plan, partnershipSigned, lastShownAt } = params
  const config = getPlanConfig(plan)
  if (config.partnershipRequired) {
    if (!partnershipSigned) return false
    if (!lastShownAt) return true
    return (Date.now() - lastShownAt.getTime()) / 3_600_000 >= 168
  }
  if (config.adFrequencyHours === null) return false
  if (!lastShownAt) return true
  return (Date.now() - lastShownAt.getTime()) / 3_600_000 >= config.adFrequencyHours
}
