import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api.js'
import ExpenseCreationDialog from './ExpenseCreationDialog.jsx'
import GroupMemberDialog from './GroupMemberDialog.jsx'

function formatCurrency(amount, currency) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(amount)
}

function getInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function getExpenseIcon(description) {
  const normalizedDescription = description.toLocaleLowerCase('pt-BR')
  const categories = [
    { terms: ['hotel', 'hosped', 'pousada', 'aluguel'], icon: '🛏️' },
    { terms: ['jantar', 'almoço', 'almoco', 'restaurante', 'café', 'cafe', 'comida'], icon: '🍽️' },
    { terms: ['taxi', 'táxi', 'uber', 'transporte', 'combustível', 'combustivel'], icon: '🚕' },
    { terms: ['mercado', 'supermercado', 'compra'], icon: '🛍️' },
    { terms: ['viagem', 'passagem', 'voo', 'avião', 'aviao'], icon: '✈️' },
    { terms: ['ingresso', 'museu', 'passeio', 'show'], icon: '🎟️' },
  ]
  const category = categories.find(({ terms }) => (
    terms.some((term) => normalizedDescription.includes(term))
  ))

  return category?.icon ?? '🧾'
}

function GroupDetails({ group, onBack, onMembersUpdated }) {
  const [expenses, setExpenses] = useState([])
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(true)
  const [expensesError, setExpensesError] = useState('')
  const [isCreatingExpense, setIsCreatingExpense] = useState(false)
  const [isAddingMembers, setIsAddingMembers] = useState(false)
  const [expenseNotice, setExpenseNotice] = useState('')
  const [memberNotice, setMemberNotice] = useState('')
  const members = group.members ?? []
  const totalExpenses = expenses.reduce((total, expense) => total + Number(expense.amount), 0)
  const memberNames = new Map(members.map((member) => [String(member.user_id), member.name]))
  const memberBalances = new Map(members.map((member) => [String(member.user_id), 0]))
  const pairBalances = new Map()
  expenses.forEach((expense) => {
    const payerId = String(expense.paid_by_id)
    if (memberBalances.has(payerId)) {
      memberBalances.set(
        payerId,
        memberBalances.get(payerId) + Math.round(Number(expense.amount) * 100),
      )
    }
    expense.participants.forEach((participant) => {
      const debtorId = String(participant.user_id)
      const cents = Math.round(Number(participant.amount) * 100)
      if (memberBalances.has(debtorId)) {
        memberBalances.set(debtorId, memberBalances.get(debtorId) - cents)
      }
      if (debtorId === payerId) return

      const [firstId, secondId] = [debtorId, payerId].sort()
      const pairKey = `${firstId}:${secondId}`
      const debtDirection = debtorId === firstId ? 1 : -1
      pairBalances.set(
        pairKey,
        (pairBalances.get(pairKey) ?? 0) + cents * debtDirection,
      )
    })
  })
  const pairwiseDebts = [...pairBalances.entries()]
    .flatMap(([pairKey, balance]) => {
      if (balance === 0) return []
      const [firstId, secondId] = pairKey.split(':')
      const debtorId = balance > 0 ? firstId : secondId
      const creditorId = balance > 0 ? secondId : firstId

      return [{
        id: pairKey,
        debtor: memberNames.get(debtorId) ?? 'Participante',
        creditor: memberNames.get(creditorId) ?? 'Participante',
        amount: Math.abs(balance) / 100,
      }]
    })
    .sort((first, second) => second.amount - first.amount)
  const formattedCreatedAt = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
  }).format(new Date(group.created_at))

  useEffect(() => {
    let isCurrent = true

    apiRequest(`/api/groups/${group.id}/expenses/`)
      .then((result) => {
        if (isCurrent) {
          setExpenses(result)
          setExpensesError('')
        }
      })
      .catch((error) => {
        if (isCurrent) setExpensesError(error.message)
      })
      .finally(() => {
        if (isCurrent) setIsLoadingExpenses(false)
      })

    return () => {
      isCurrent = false
    }
  }, [group.id])

  function handleExpenseCreated(expense) {
    setExpenses((currentExpenses) => [expense, ...currentExpenses])
    setIsCreatingExpense(false)
    setExpenseNotice('Despesa registrada com sucesso.')
  }

  function handleMemberAdded(membership) {
    const updatedMembers = [...members, membership]
    onMembersUpdated(updatedMembers)
    setMemberNotice(`${membership.name} foi adicionado ao grupo.`)
  }

  function handleRetryExpenses() {
    setIsLoadingExpenses(true)
    setExpensesError('')
    apiRequest(`/api/groups/${group.id}/expenses/`)
      .then(setExpenses)
      .catch((error) => setExpensesError(error.message))
      .finally(() => setIsLoadingExpenses(false))
  }

  return (
    <div className="group-details">
      <header className="group-details__hero">
        <button className="group-details__back" type="button" onClick={onBack}>
          <span aria-hidden="true">←</span>
          Voltar para grupos
        </button>
        <div className="group-details__identity">
          <span className="group-details__avatar">
            <img src="/cat.png" alt="" />
          </span>
          <div>
            <p className="group-details__eyebrow">GRUPO COMPARTILHADO</p>
            <h1>{group.name}</h1>
            <p>Criado em {formattedCreatedAt}</p>
          </div>
        </div>
      </header>

      <section className="group-details__summary" aria-label="Resumo do grupo">
        <article className="group-details__simplify-card">
          <div className="group-details__simplify-copy">
            <span className="group-details__metric-label">Acertos entre participantes</span>
            {isLoadingExpenses ? (
              <p role="status">Calculando acertos...</p>
            ) : expensesError ? (
              <p role="alert">Não foi possível carregar os acertos.</p>
            ) : pairwiseDebts.length ? (
              <ul className="group-details__debt-list">
                {pairwiseDebts.map((debt) => (
                  <li key={debt.id}>
                    <span>{debt.debtor} deve</span>
                    <strong>{formatCurrency(debt.amount, group.currency)}</strong>
                    <span>a {debt.creditor}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Não há valores pendentes entre os participantes.</p>
            )}
          </div>
          <button
            className="group-details__simplify-button"
            type="button"
            disabled
            title="Disponível em breve"
          >
            Simplificar despesas
          </button>
        </article>
        <article className="group-details__metric group-details__metric--purple">
          <span className="group-details__metric-label">Total de despesas</span>
          <strong>{formatCurrency(totalExpenses, group.currency)}</strong>
          <small>
            {expenses.length
              ? `${expenses.length} ${expenses.length === 1 ? 'despesa registrada' : 'despesas registradas'}`
              : 'Nenhuma despesa registrada'}
          </small>
        </article>
        {/* <article className="group-details__metric group-details__metric--peach">
          <span className="group-details__metric-label">Despesas</span>
          <strong>{expenses.length}</strong>
          <small>lançamentos no grupo</small>
        </article> */}
      </section>

      <div className="group-details__columns">
        <section className="group-details__panel" aria-labelledby="group-expenses-title">
          <div className="group-details__section-heading">
            <div>
              <h2 id="group-expenses-title">Despesas</h2>
              <p>Os gastos compartilhados aparecerão aqui.</p>
            </div>
            <div className="group-details__expense-actions">
              <span className="group-details__section-count">{expenses.length}</span>
              <button
                className="group-details__add-expense"
                type="button"
                onClick={() => {
                  setExpenseNotice('')
                  setIsCreatingExpense(true)
                }}
              >
                <span aria-hidden="true">+</span>
                Adicionar despesa
              </button>
            </div>
          </div>
          {isLoadingExpenses ? (
            <p className="group-details__expense-notice" role="status">Carregando despesas...</p>
          ) : expensesError ? (
            <div className="group-details__expense-notice group-details__expense-notice--error" role="alert">
              <span>{expensesError}</span>
              <button type="button" onClick={handleRetryExpenses}>Tentar novamente</button>
            </div>
          ) : expenses.length === 0 ? (
            <div className="group-details__empty">
              <span className="group-details__empty-icon" aria-hidden="true">$</span>
              <strong>Nenhuma despesa por enquanto</strong>
              <p>Quando uma despesa for adicionada, você poderá acompanhar o valor e como será dividido entre os participantes.</p>
            </div>
          ) : (
            <ul className="group-details__expenses">
              {expenses.map((expense, index) => (
                <li className="group-details__expense" key={expense.id}>
                  <div className="group-details__expense-heading">
                    <span
                      className={`group-details__expense-icon group-details__expense-icon--${index % 4}`}
                      aria-hidden="true"
                    >
                      {getExpenseIcon(expense.description)}
                    </span>
                    <div>
                      <strong>{expense.description}</strong>
                      <small>Pago por {expense.paid_by_name}</small>
                    </div>
                    <strong>{formatCurrency(Number(expense.amount), group.currency)}</strong>
                  </div>
                  <ul className="group-details__shares">
                    {expense.participants.map((participant) => (
                      <li key={participant.user_id}>
                        <span>{participant.name}</span>
                        <span>
                          {formatCurrency(Number(participant.amount), group.currency)}
                          {participant.percentage !== null && ` · ${participant.percentage}%`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          {expenseNotice && <p className="group-details__expense-notice" role="status">{expenseNotice}</p>}
        </section>

        <section className="group-details__panel" aria-labelledby="group-members-title">
          <div className="group-details__section-heading group-details__members-heading">
            <div>
              <h2 id="group-members-title">Participantes</h2>
              <p>Pessoas que fazem parte deste grupo.</p>
            </div>
            <div className="group-details__member-actions">
              <span className="group-details__section-count">{members.length}</span>
              <button
                className="group-details__add-member"
                type="button"
                onClick={() => {
                  setMemberNotice('')
                  setIsAddingMembers(true)
                }}
              >
                <span aria-hidden="true">+</span>
                Adicionar pessoas
              </button>
            </div>
          </div>
          <ul className="group-details__members">
            {members.map((member, index) => (
              <li className="group-details__member" key={member.id}>
                <span className={`group-details__member-avatar group-details__member-avatar--${index % 4}`}>
                  {getInitials(member.name)}
                </span>
                <span className="group-details__member-info">
                  <strong>
                    {member.name}
                    {member.is_current_user && <span className="group-details__you">Você</span>}
                  </strong>
                  <small>{member.role === 'admin' ? 'Administrador' : 'Integrante'}</small>
                </span>
                <span className="group-details__member-role">
                  {member.role === 'admin' ? 'Admin' : 'Membro'}
                </span>
              </li>
            ))}
          </ul>
          {memberNotice && <p className="group-details__expense-notice" role="status">{memberNotice}</p>}
          <section className="group-details__balance-summary" aria-labelledby="group-balances-title">
            <h3 id="group-balances-title">Saldos calculados</h3>
            {isLoadingExpenses ? (
              <small role="status">Calculando saldos...</small>
            ) : expensesError ? (
              <small role="alert">Não foi possível calcular os saldos.</small>
            ) : members.map((member) => {
                const balance = memberBalances.get(String(member.user_id)) ?? 0
                const balanceLabel = balance > 0
                  ? `A receber ${formatCurrency(balance / 100, group.currency)}`
                  : balance < 0
                    ? `A pagar ${formatCurrency(Math.abs(balance) / 100, group.currency)}`
                    : 'Sem saldo pendente'
                return (
                  <div className="group-details__balance" key={member.id}>
                    <span>{member.name}</span>
                    <strong className={balance > 0 ? 'is-credit' : balance < 0 ? 'is-debt' : ''}>
                      {balanceLabel}
                    </strong>
                  </div>
                )
              })}
          </section>
        </section>
      </div>
      {isCreatingExpense && (
        <ExpenseCreationDialog
          group={group}
          onClose={() => setIsCreatingExpense(false)}
          onCreated={handleExpenseCreated}
        />
      )}
      {isAddingMembers && (
        <GroupMemberDialog
          group={group}
          onClose={() => setIsAddingMembers(false)}
          onAdded={handleMemberAdded}
        />
      )}
    </div>
  )
}

export default GroupDetails
