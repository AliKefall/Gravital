import { useEffect, useState } from "react"
import "./App.css"
import { ChatWorkspace } from "./components/ChatWorkspace"
import { AuthPage } from "./pages/AuthPage"
import type { LoginResponse } from "./types/auth"
import { fetchCurrentUser, refreshSession } from "./api/auth"

export type AppLanguage = "en" | "tr"
export type AppTheme = "light" | "dark"

function App() {
  const [session, setSession] = useState<LoginResponse | null>(null)
  const [hydrating, setHydrating] = useState(true)
  const [language, setLanguage] = useState<AppLanguage>(() => (localStorage.getItem("gravital-language") === "tr" ? "tr" : "en"))
  const [theme, setTheme] = useState<AppTheme>(() => (localStorage.getItem("gravital-theme") === "dark" ? "dark" : "light"))

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
    localStorage.setItem("gravital-theme", theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem("gravital-language", language)
  }, [language])

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

  const languageLabel = language === "en" ? "TR" : "ENG"
  const themeLabel = theme === "light" ? "Dark" : "Light"

  if (hydrating) {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-loading">
          <h1>Gravital Chat</h1>
          <p>{language === "en" ? "Checking session..." : "Oturum kontrol ediliyor..."}</p>
        </section>
      </main>
    )
  }

  return (
    <>
      <div className="app-float-controls" aria-label="Display and language controls">
        <button type="button" className="control-chip" onClick={() => setLanguage((prev) => (prev === "en" ? "tr" : "en"))}>
          {languageLabel}
        </button>
        <button type="button" className="control-chip" onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}>
          {themeLabel}
        </button>
      </div>

      {!session ? (
        <AuthPage onLogin={setSession} language={language} />
      ) : (
        <ChatWorkspace
          username={session.user.username}
          token={session.access_token}
          onLogout={() => setSession(null)}
          language={language}
        />
      )}
    </>
  )
}

export default App
