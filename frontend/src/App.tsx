import { useEffect, useState } from "react"
import "./App.css"
import { ChatWorkspace } from "./components/ChatWorkspace"
import { AuthPage } from "./pages/AuthPage"
import type { LoginResponse } from "./types/auth"
import { fetchCurrentUser, refreshSession } from "./api/auth"

function App() {
  const [session, setSession] = useState<LoginResponse | null>(null)
  const [hydrating, setHydrating] = useState(true)

  useEffect(() => {
    let cancelled = false
    const bootstrapSession = async () => {
      try {
        const refresh = await refreshSession()
        const me = await fetchCurrentUser(refresh.access_token)

        if (!cancelled) {
          setSession({
            access_token: refresh.access_token,
            user: {
              user_id: me.user_id,
              username: me.username,
              email: me.email ?? "",
            },
          })
        }
      } catch {
        if (!cancelled) {
          setSession(null)
        }
      } finally {
        if (!cancelled) {
          setHydrating(false)
        }
      }
    }
    void bootstrapSession()
    return () => {
      cancelled = true
    }
  }, [])
  if (hydrating) {
    return (<main className="auth-shell">
      <section className="auth-card auth-loading">
        <h1>Gravital Chat</h1>
        <p>Oturum kontrol ediliyor...</p>
      </section>
    </main>)
  }
  if (!session) {
    return <AuthPage onLogin={setSession} />
  }

  return (
    <ChatWorkspace
      username={session.user.username}
      token={session.access_token}
      onLogout={() => setSession(null)}
    />
  )
}

export default App
