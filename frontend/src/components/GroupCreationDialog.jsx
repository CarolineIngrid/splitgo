import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api.js'

const currencyNames = new Intl.DisplayNames(['pt-BR'], { type: 'currency' })

function getCurrencyLabel(currency) {
  try {
    const localizedName = currencyNames.of(currency.code)
    return localizedName && localizedName !== currency.code
      ? localizedName
      : currency.name
  } catch {
    return currency.name
  }
}

function GroupCreationDialog({ onClose, onCreated }) {
  const [currencies, setCurrencies] = useState([])
  const [isLoadingCurrencies, setIsLoadingCurrencies] = useState(true)
  const [currencyError, setCurrencyError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    let isCurrent = true

    apiRequest('/api/groups/currencies/')
      .then((availableCurrencies) => {
        if (isCurrent) setCurrencies(availableCurrencies)
      })
      .catch((error) => {
        if (isCurrent) setCurrencyError(error.message)
      })
      .finally(() => {
        if (isCurrent) setIsLoadingCurrencies(false)
      })

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      isCurrent = false
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')
    setIsSubmitting(true)
    const formData = new FormData(event.currentTarget)

    try {
      const group = await apiRequest('/api/groups/', {
        method: 'POST',
        body: {
          name: formData.get('name').trim(),
          currency: formData.get('currency'),
        },
      })
      onCreated(group)
    } catch (error) {
      setFormError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleRetryCurrencies() {
    setIsLoadingCurrencies(true)
    setCurrencyError('')
    apiRequest('/api/groups/currencies/')
      .then(setCurrencies)
      .catch((error) => setCurrencyError(error.message))
      .finally(() => setIsLoadingCurrencies(false))
  }

  return (
    <div
      className="group-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="group-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-dialog-title"
        aria-describedby="group-dialog-description"
      >
        <button
          className="group-dialog__close"
          type="button"
          aria-label="Fechar criação de grupo"
          onClick={onClose}
        >
          ×
        </button>
        <span className="group-dialog__icon" aria-hidden="true">＋</span>
        <p className="dashboard-eyebrow">NOVO ESPAÇO COMPARTILHADO</p>
        <h2 id="group-dialog-title">Criar grupo</h2>
        <p id="group-dialog-description" className="group-dialog__description">
          Dê um nome ao grupo e escolha a moeda que será usada para as despesas.
        </p>

        <form className="group-dialog__form" onSubmit={handleSubmit}>
          <label className="group-dialog__field" htmlFor="group-name">
            <span>Nome do grupo</span>
            <input
              autoFocus
              id="group-name"
              name="name"
              type="text"
              maxLength={100}
              placeholder="Ex.: Viagem para o litoral"
              autoComplete="off"
              required
            />
          </label>

          <label className="group-dialog__field" htmlFor="group-currency">
            <span>Moeda de referência</span>
            <select
              id="group-currency"
              name="currency"
              defaultValue=""
              required
              disabled={isLoadingCurrencies || Boolean(currencyError)}
            >
              <option value="" disabled>
                {isLoadingCurrencies ? 'Carregando moedas...' : 'Selecione uma moeda'}
              </option>
              {currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} — {getCurrencyLabel(currency)}
                </option>
              ))}
            </select>
          </label>

          {currencyError && (
            <div className="group-dialog__error" role="alert">
              <span>{currencyError}</span>
              <button type="button" onClick={handleRetryCurrencies}>Tentar novamente</button>
            </div>
          )}
          {formError && <p className="group-dialog__error" role="alert">{formError}</p>}

          <div className="group-dialog__actions">
            <button className="group-dialog__cancel" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="dashboard-button dashboard-button--primary"
              type="submit"
              disabled={isSubmitting || isLoadingCurrencies || Boolean(currencyError)}
            >
              {isSubmitting ? 'Criando grupo...' : 'Criar grupo'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default GroupCreationDialog
