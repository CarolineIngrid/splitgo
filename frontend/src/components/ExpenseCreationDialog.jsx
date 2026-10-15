import { useState } from 'react'
import { apiRequest } from '../lib/api.js'

function ExpenseCreationDialog({ group, onClose, onCreated }) {
  const members = group.members ?? []
  const initialParticipants = members.map((member) => String(member.user_id))
  const initialPayer = members.find((member) => member.is_current_user)?.user_id ?? members[0]?.user_id ?? ''
  const [participants, setParticipants] = useState(initialParticipants)
  const [shareValues, setShareValues] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [splitType, setSplitType] = useState('equal')

  function toggleParticipant(memberId) {
    setParticipants((current) => current.includes(memberId)
      ? current.filter((id) => id !== memberId)
      : [...current, memberId])
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')
    setIsSubmitting(true)
    const formData = new FormData(event.currentTarget)
    // Enviar somente os participantes selecionados e os valores do critério escolhido.
    const participantPayload = members
      .filter((member) => participants.includes(String(member.user_id)))
      .map((member) => {
        const participant = { user_id: member.user_id }
        if (splitType !== 'equal') {
          participant.value = shareValues[member.user_id] ?? ''
        }
        return participant
      })

    try {
      const expense = await apiRequest(`/api/groups/${group.id}/expenses/`, {
        method: 'POST',
        body: {
          description: formData.get('description').trim(),
          amount: formData.get('amount'),
          paid_by: formData.get('paid_by'),
          split_type: splitType,
          participants: participantPayload,
        },
      })
      onCreated(expense)
    } catch (error) {
      setFormError(error.message)
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
        aria-labelledby="expense-dialog-title"
      >
        <button
          className="group-dialog__close"
          type="button"
          aria-label="Fechar registro de despesa"
          onClick={onClose}
        >
          ×
        </button>
        <span className="group-dialog__icon" aria-hidden="true">$</span>
        <p className="dashboard-eyebrow">DESPESA COMPARTILHADA</p>
        <h2 id="expense-dialog-title">Adicionar despesa</h2>
        <p className="group-dialog__description">
          Registre o pagamento e defina como o valor será dividido entre o grupo.
        </p>

        <form className="group-dialog__form" onSubmit={handleSubmit}>
          <label className="group-dialog__field" htmlFor="expense-description">
            <span>Descrição</span>
            <input
              autoFocus
              id="expense-description"
              name="description"
              type="text"
              maxLength={120}
              placeholder="Ex.: Jantar de sexta-feira"
              required
            />
          </label>

          <div className="expense-dialog__fields">
            <label className="group-dialog__field" htmlFor="expense-amount">
              <span>Valor total ({group.currency})</span>
              <input
                id="expense-amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                placeholder="0,00"
                required
              />
            </label>
            <label className="group-dialog__field" htmlFor="expense-payer">
              <span>Pago por</span>
              <select id="expense-payer" name="paid_by" defaultValue={initialPayer} required>
                {members.map((member) => (
                  <option key={member.id} value={member.user_id}>{member.name}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="group-dialog__field" htmlFor="expense-split-type">
            <span>Critério de rateio</span>
            <select
              id="expense-split-type"
              value={splitType}
              onChange={(event) => setSplitType(event.target.value)}
            >
              <option value="equal">Dividir igualmente</option>
              <option value="amount">Definir valores por pessoa</option>
              <option value="percentage">Definir percentuais</option>
            </select>
          </label>

          <fieldset className="expense-dialog__participants">
            <legend>Participantes do rateio</legend>
            {members.map((member) => {
              const memberId = String(member.user_id)
              const isSelected = participants.includes(memberId)
              return (
                <label className="expense-dialog__participant" key={member.id}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleParticipant(memberId)}
                  />
                  <span>{member.name}</span>
                  {isSelected && splitType !== 'equal' && (
                    <span className="expense-dialog__share-input">
                      <input
                        aria-label={`${splitType === 'percentage' ? 'Percentual' : 'Valor'} de ${member.name}`}
                        type="number"
                        min="0.01"
                        max={splitType === 'percentage' ? '100' : undefined}
                        step="0.01"
                        inputMode="decimal"
                        value={shareValues[member.user_id] ?? ''}
                        onChange={(event) => setShareValues((current) => ({
                          ...current,
                          [member.user_id]: event.target.value,
                        }))}
                        required
                      />
                      <small>{splitType === 'percentage' ? '%' : group.currency}</small>
                    </span>
                  )}
                </label>
              )
            })}
          </fieldset>

          {formError && <p className="group-dialog__error" role="alert">{formError}</p>}

          <div className="group-dialog__actions">
            <button className="group-dialog__cancel" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="dashboard-button dashboard-button--primary"
              type="submit"
              disabled={isSubmitting || participants.length === 0}
            >
              {isSubmitting ? 'Salvando...' : 'Salvar despesa'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default ExpenseCreationDialog
