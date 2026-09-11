import 'server-only'

import Stripe from 'stripe'

let cachedClient: Stripe | null = null

export function getStripeClient() {
  if (cachedClient) return cachedClient

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }

  cachedClient = new Stripe(secretKey, { apiVersion: '2026-08-26.dahlia' })
  return cachedClient
}
