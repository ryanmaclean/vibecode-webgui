import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      image?: string | null
      role: string
      githubId?: string | null
      googleId?: string | null
    }
  }

  interface User {
    id: string
    email: string
    name: string
    image?: string | null
    role: string
    githubId?: string | null
    googleId?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string | null
    role?: string | null
    githubId?: string | null
    googleId?: string | null
    email?: string | null
    name?: string | null
  }
}
