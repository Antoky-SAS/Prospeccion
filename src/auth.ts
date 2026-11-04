import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const permitidos = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      return !!email && profile?.email_verified === true && permitidos.includes(email);
    },
  },
});

/** Email del vendedor en sesión; su calendario principal tiene el mismo id. */
export async function getSessionEmail(): Promise<string | null> {
  const session = await auth();
  return session?.user?.email?.toLowerCase() ?? null;
}
