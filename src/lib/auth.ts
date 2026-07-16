import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db, withRetry } from './db';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: { username: { label: 'Логин', type: 'text' }, password: { label: 'Пароль', type: 'password' } },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const user = await withRetry(() => db.user.findUnique({ where: { username: credentials.username } }));
        if (!user || !user.isActive) return null;
        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;
        await withRetry(() => db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }));
        return { id: user.id, name: user.displayName || user.username, role: user.role, workspace: user.workspace };
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.role = (user as Record<string, unknown>).role; token.workspace = (user as Record<string, unknown>).workspace; }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).role = token.role;
        (session.user as Record<string, unknown>).workspace = token.workspace;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};