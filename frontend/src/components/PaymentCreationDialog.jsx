import { useState } from 'react'
import { apiRequest } from '../lib/api.js'

function PaymentCreationDialog({ group, onClose, onCreated }) {
  const members = group.members ?? []
  const currentMember = members.find((member) => member.is_current_user) ?? members[0]
  const [payerId, setPayerId] = useState(currentMember?.user_id ?? '')
  const [recipientId, setRecipientId] = useState(
    members.find((member) => String(member.user_id) !== String(currentMember?.user_id ?? ''))?.user_id ?? '',
  )
  const [description, setDescription] = useState('Pagamento')
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const availableRecipients = members.filter(
    (member) => String(member.user_id) !== String(payerId),
  )

  function handlePayerChange(nextPayerId) {
    setPayerId(nextPayerId)
    const nextRecipient = members.find(
      (member) => String(member.user_id) !== String(nextPayerId),
    )
    setRecipientId(nextRecipient?.user_id ?? '')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')
    setIsSubmitting(true)

    if (!payerId || !recipientId) {
      setFormError('Selecione quem pagou e para quem foi o pagamento.')
      setIsSubmitting(false)
      return
    }

    try {
      const payment = await apiRequest(`/api/groups/${group.id}/payments/`, {
        method: 'POST',
        body: {
          description: description.trim() || 'Pagamento',
          amount,
          paid_by: payerId,
          paid_to: recipientId,
        },
      })
      onCreated(payment)
    } catch (error) {
      setFormError(error.message)
      window.alert(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="group-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="group-dialog expense-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-dialog-title"
      >
        <button
          className="group-dialog__close"
          type="button"
          aria-label="Fechar registro de pagamento"
          onClick={onClose}
        >
          ×
        </button>
        <span className="group-dialog__icon" aria-hidden="true">$</span>
        <p className="dashboard-eyebrow">PAGAMENTO</p>
        <h2 id="payment-dialog-title">Registrar pagamento</h2>
        <p className="group-dialog__description">
          Registre um pagamento entre participantes e reduza automaticamente o valor que está pendente.
        </p>

        <form className="group-dialog__form" onSubmit={handleSubmit}>
          <label className="group-dialog__field" htmlFor="payment-description">
            <span>Descrição</span>
            <input
              autoFocus
              id="payment-description"
              name="description"
              type="text"
              maxLength={120}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ex.: Pagamento do jantar"
            />
          </label>

          <div className="expense-dialog__fields">
            <label className="group-dialog__field" htmlFor="payment-payer">
              <span>Quem pagou</span>
              <select
                id="payment-payer"
                value={payerId}
                onChange={(event) => handlePayerChange(event.target.value)}
                required
              >
                {members.map((member) => (
                  <option key={member.id} value={member.user_id}>{member.name}</option>
                ))}
              </select>
            </label>

            <label className="group-dialog__field" htmlFor="payment-recipient">
              <span>Para quem</span>
              <select
                id="payment-recipient"
                value={recipientId}
                onChange={(event) => setRecipientId(event.target.value)}
                required
              >
                {availableRecipients.length === 0 ? (
                  <option value="">Nenhum destinatário disponível</option>
                ) : (
                  availableRecipients.map((member) => (
                    <option key={member.id} value={member.user_id}>{member.name}</option>
                  ))
                )}
              </select>
            </label>
          </div>

          <label className="group-dialog__field" htmlFor="payment-amount">
            <span>Valor do pagamento ({group.currency})</span>
            <input
              id="payment-amount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0,00"
              required
            />
          </label>

          {formError && <p className="group-dialog__error" role="alert">{formError}</p>}

          <div className="group-dialog__actions">
            <button className="group-dialog__cancel" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="dashboard-button dashboard-button--primary"
              type="submit"
              disabled={isSubmitting || !payerId || !recipientId}
            >
              {isSubmitting ? 'Salvando...' : 'Salvar pagamento'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default PaymentCreationDialog
