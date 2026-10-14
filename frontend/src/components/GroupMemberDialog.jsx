import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api.js'

function GroupMemberDialog({ group, onClose, onAdded }) {
  const [availableUsers, setAvailableUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadingError, setLoadingError] = useState('')
  const [addingUserId, setAddingUserId] = useState('')
  const [formError, setFormError] = useState('')

  useEffect(() => {
    let isCurrent = true

    apiRequest(`/api/groups/${group.id}/members/`)
      .then((users) => {
        if (isCurrent) {
          setAvailableUsers(users)
          setLoadingError('')
        }
      })
      .catch((error) => {
        if (isCurrent) setLoadingError(error.message)
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [group.id])

  async function handleAdd(user) {
    setFormError('')
    setAddingUserId(user.id)
    try {
      const membership = await apiRequest(`/api/groups/${group.id}/members/`, {
        method: 'POST',
        body: { user_id: user.id },
      })
      setAvailableUsers((currentUsers) => currentUsers.filter(
        (availableUser) => availableUser.id !== user.id,
      ))
      onAdded(membership)
    } catch (error) {
      setFormError(error.message)
    } finally {
      setAddingUserId('')
    }
  }

  function handleRetry() {
    setIsLoading(true)
    setLoadingError('')
    apiRequest(`/api/groups/${group.id}/members/`)
      .then(setAvailableUsers)
      .catch((error) => setLoadingError(error.message))
      .finally(() => setIsLoading(false))
  }

  return (
    <div
      className="group-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="group-dialog group-member-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-member-dialog-title"
        aria-describedby="group-member-dialog-description"
      >
        <button
          className="group-dialog__close"
          type="button"
          aria-label="Fechar adição de participantes"
          onClick={onClose}
        >
          ×
        </button>
        <span className="group-dialog__icon" aria-hidden="true">＋</span>
        <p className="dashboard-eyebrow">GRUPO COMPARTILHADO</p>
        <h2 id="group-member-dialog-title">Adicionar participantes</h2>
        <p id="group-member-dialog-description" className="group-dialog__description">
          Escolha qualquer pessoa cadastrada no Split&amp;Go para adicionar a este grupo.
        </p>

        {isLoading ? (
          <p className="group-details__expense-notice" role="status">Carregando pessoas...</p>
        ) : loadingError ? (
          <div className="group-dialog__error" role="alert">
            <span>{loadingError}</span>
            <button type="button" onClick={handleRetry}>Tentar novamente</button>
          </div>
        ) : availableUsers.length === 0 ? (
          <div className="group-member-dialog__empty">
            Todas as pessoas cadastradas já fazem parte deste grupo.
          </div>
        ) : (
          <ul className="group-member-dialog__list">
            {availableUsers.map((user) => (
              <li className="group-member-dialog__item" key={user.id}>
                <span className="group-member-dialog__identity">
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                </span>
                <button
                  className="group-member-dialog__add"
                  type="button"
                  onClick={() => handleAdd(user)}
                  disabled={Boolean(addingUserId)}
                >
                  {addingUserId === user.id ? 'Adicionando...' : 'Adicionar'}
                </button>
              </li>
            ))}
          </ul>
        )}

        {formError && <p className="group-dialog__error" role="alert">{formError}</p>}
        <div className="group-dialog__actions">
          <button className="group-dialog__cancel" type="button" onClick={onClose}>
            Concluir
          </button>
        </div>
      </section>
    </div>
  )
}

export default GroupMemberDialog
