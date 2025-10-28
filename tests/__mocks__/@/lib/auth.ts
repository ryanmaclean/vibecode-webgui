// Mock auth configuration for testing
export const authOptions = {
  providers: [],
  session: { strategy: 'jwt' },
  jwt: { secret: 'test-secret' },
}