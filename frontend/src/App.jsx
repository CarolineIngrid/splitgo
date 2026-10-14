import { useEffect, useState } from 'react'
import AuthPage from './components/AuthPage.jsx'
import Dashboard from './components/Dashboard.jsx'
import { apiRequest } from './lib/api.js'

function LoadingPage({ message }) {
  return (
    <main className="app-loading" role="status">
      <span className="app-loading__spinner" aria-hidden="true" />
      <p>{message}</p>
    </main>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')

  useEffect(() => {
    let isCurrent = true

    apiRequest('/api/auth/session/')
      .then((result) => {
        if (isCurrent) {
          setUser(result.authenticated ? result.user : null)
          setIsLoading(false)
        }
      })
      .catch((error) => {
        if (isCurrent) {
          setSessionError(error.message)
          setIsLoading(false)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [])

  if (isLoading) {
    return <LoadingPage message="Carregando sua conta..." />
  }

  if (sessionError) {
    return (
      <main className="app-loading app-loading--error" role="alert">
        <p>Não foi possível conectar ao servidor: {sessionError}</p>
        <button type="button" onClick={() => window.location.reload()}>Tentar novamente</button>
      </main>
    )
  }

  return user
    ? <Dashboard user={user} onLogout={() => setUser(null)} />
    : <AuthPage onAuthenticated={setUser} />
}

export default App