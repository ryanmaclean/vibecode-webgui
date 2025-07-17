/**
 * Sign In page for VibeCode WebGUI
 * Renders the authentication form
 */

import { Metadata } from 'next'
import SimpleSignInForm from '@/components/auth/SimpleSignInForm'

export const metadata: Metadata = {
  title: 'Sign In - VibeCode WebGUI',
  description: 'Sign in to your VibeCode account',
}

export default function SignInPage() {
  return <SimpleSignInForm />
}
