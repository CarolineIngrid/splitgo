import { useState } from 'react'
import { apiRequest } from '../lib/api.js'
import './AuthPage.css'

const authModes = {
  login: {
    title: 'Bom ter você de volta',
    description: 'Entre para organizar as contas e aproveitar mais os momentos.',
    button: 'Entrar na minha conta',
    switchText: 'Ainda não tem uma conta?',
    switchAction: 'Criar conta',
  },
  signup: {
    title: 'Vamos nessa?',
    description: 'Crie sua conta e deixe a divisão das despesas por nossa conta.',
    button: 'Criar minha conta',
    switchText: 'Já tem uma conta?',
    switchAction: 'Fazer login',
  },
}

function BrandMark({ compact = false }) {
  return (
    <a className={`brand ${compact ? 'brand--compact' : ''}`} href="#inicio" aria-label="Split and Go, início">
      <img className="brand__logo" src="/cat.png" alt="" />
      <span>split <strong>&amp; go</strong></span>
    </a>
  )
}

function BrandPanel() {
  return (
    <section className="brand-panel" aria-label="Conheça o Split and Go">
      <div className="brand-panel__top">
        <BrandMark />
        <span className="brand-panel__eyebrow">DESPESAS COMPARTILHADAS, SEM COMPLICAÇÃO</span>
      </div>

      <div className="brand-panel__content">
        <div className="brand-panel__copy">
          <p className="eyebrow">MAIS MOMENTOS. MENOS CONTAS.</p>
          <h1>Dividir fica leve quando é <span>junto.</span></h1>
          <p className="brand-panel__description">
            Organize as despesas do grupo, acompanhe os acertos e curta o que realmente importa.
          </p>
        </div>

        <div className="phone-scene" aria-label="Prévia do aplicativo Split and Go">
          <div className="phone">
            <div className="phone__notch" />
            <div className="phone__screen">
              <div className="phone__status"><span>9:41</span><span>● ● ▰</span></div>
              <div className="phone__greeting">Viagem de fim de semana <span>⌄</span></div>
              <div className="balance-card">
                <span>Total das despesas</span>
                <strong>R$ 842,50</strong>
                <div className="balance-card__people">
                  <span className="avatar avatar--lilac">M</span>
                  <span className="avatar avatar--peach">L</span>
                  <span className="avatar avatar--green">A</span>
                  <span className="balance-card__count">+ 2 pessoas</span>
                </div>
              </div>
              <div className="phone__section-title">Atividade recente <span>Ver tudo</span></div>
              <div className="expense-item">
                <span className="expense-icon expense-icon--orange">↗</span>
                <span className="expense-item__detail"><strong>Mercado</strong><small>Marina pagou</small></span>
                <strong>R$ 186,40</strong>
              </div>
              <div className="expense-item">
                <span className="expense-icon expense-icon--green">⌂</span>
                <span className="expense-item__detail"><strong>Hospedagem</strong><small>Lucas pagou</small></span>
                <strong>R$ 420,00</strong>
              </div>
              <div className="phone__settlement"><span>✓</span> Tudo dividido. É só aproveitar!</div>
            </div>
          </div>
          <div className="float-card float-card--top"><span>✦</span> Tudo em equilíbrio</div>
          <div className="float-card float-card--bottom"><span className="float-card__check">✓</span><span><strong>Acerto concluído</strong><small>Agora está tudo certo!</small></span></div>
          <span className="scene-orbit scene-orbit--one" />
          <span className="scene-orbit scene-orbit--two" />
        </div>
      </div>

    </section>
  )
}

function FormField({ label, type = 'text', name, autoComplete, placeholder }) {
  const id = `auth-${name}`

  return (
    <label className="form-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
      />
    </label>
  )
}

function AuthForm({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const currentMode = authModes[mode]
  const isSignup = mode === 'signup'

  function changeMode(nextMode) {
    setMode(nextMode)
    setFeedback('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFeedback('')

    const form = event.currentTarget
    const formData = new FormData(form)
    const credentials = {
      email: formData.get('email'),
      password: formData.get('password'),
    }
    setIsSubmitting(true)

    try {
      if (isSignup) {
        await apiRequest('/api/auth/register/', {
          method: 'POST',
          body: {
            name: formData.get('name'),
            ...credentials,
          },
        })
        form.reset()
        setMode('login')
        setFeedback('Conta criada com sucesso. Entre com seu e-mail e senha.')
      } else {
        const result = await apiRequest('/api/auth/login/', {
          method: 'POST',
          body: credentials,
        })
        onAuthenticated(result.user)
      }
    } catch (error) {
      setFeedback(error.message || 'Não foi possível conectar ao servidor. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-panel" id="inicio">
      <div className="auth-panel__mobile-brand"><BrandMark compact /></div>
      <div className="auth-card">
        <div className="auth-tabs" role="tablist" aria-label="Acesso à conta">
          <button
            id="login-tab"
            type="button"
            role="tab"
            aria-selected={!isSignup}
            aria-controls="auth-form"
            className={!isSignup ? 'is-active' : ''}
            onClick={() => changeMode('login')}
          >
            Entrar
          </button>
          <button
            id="signup-tab"
            type="button"
            role="tab"
            aria-selected={isSignup}
            aria-controls="auth-form"
            className={isSignup ? 'is-active' : ''}
            onClick={() => changeMode('signup')}
          >
            Criar conta
          </button>
        </div>

        <header className="auth-heading">
          <p className="eyebrow">SUA VIDA EM GRUPO, MAIS SIMPLES</p>
          <h2>{currentMode.title}</h2>
          <p>{currentMode.description}</p>
        </header>

        <form id="auth-form" className="auth-form" onSubmit={handleSubmit} aria-labelledby={isSignup ? 'signup-tab' : 'login-tab'}>
          {isSignup && (
            <FormField
              label="Nome completo"
              name="name"
              autoComplete="name"
              placeholder="Como podemos te chamar?"
            />
          )}
          <FormField
            label="E-mail"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
          />
          <FormField
            label="Senha"
            type="password"
            name="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            placeholder="Pelo menos 8 caracteres"
          />

          {isSignup ? (
            <label className="terms-check">
              <input type="checkbox" required />
              <span>Concordo com os <a href="#termos">termos de uso</a> e a <a href="#privacidade">política de privacidade</a>.</span>
            </label>
          ) : (
            <div className="form-options">
              <label className="remember-check"><input type="checkbox" /> <span>Manter conectado</span></label>
              <a href="#recuperar-senha">Esqueci minha senha</a>
            </div>
          )}

          <button className="submit-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? isSignup ? 'Criando conta...' : 'Entrando...' : currentMode.button}
            {!isSubmitting && <span aria-hidden="true">→</span>}
          </button>
          <p className="form-feedback" role="status" aria-live="polite">{feedback}</p>
        </form>

        <p className="auth-switch">
          {currentMode.switchText}{' '}
          <button type="button" onClick={() => changeMode(isSignup ? 'login' : 'signup')}>
            {currentMode.switchAction}
          </button>
        </p>
      </div>
      <footer className="auth-footer">© 2026 Split and Go <span>•</span> Dividir é simples.</footer>
    </main>
  )
}

function AuthPage({ onAuthenticated }) {
  return (
    <div className="auth-page">
      <BrandPanel />
      <AuthForm onAuthenticated={onAuthenticated} />
    </div>
  )
}

export default AuthPage
