import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api.js'
import ExpenseCreationDialog from './ExpenseCreationDialog.jsx'
import GroupMemberDialog from './GroupMemberDialog.jsx'
import PaymentCreationDialog from './PaymentCreationDialog.jsx'

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

function getDisplayName(userId, memberNames, currentUserId) {
  const normalizedUserId = String(userId)
  if (normalizedUserId === String(currentUserId)) {
    return 'Você'
  }

  return memberNames.get(normalizedUserId) ?? 'Participante'
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

function simplifySettlements(memberBalances, members, currentUserId) {
  const memberNames = new Map(
    members.map((member) => [String(member.user_id), member.name]),
  )
  const debtors = []
  const creditors = []
  
  // memberBalances começa como um Map com todos os membros e saldo 0.
  // Para cada despesa:
  // quem pagou recebe crédito: memberBalances[payerId] += valorDaDespesa
  // cada participante que deve parte da despesa tem seu saldo reduzido: memberBalances[participant] -= valorDaParticipacao

  memberBalances.forEach((balance, userId) => {
    if (balance < 0) debtors.push({ userId, remaining: Math.abs(balance) })
    if (balance > 0) creditors.push({ userId, remaining: balance })
  })

  debtors.sort((first, second) => second.remaining - first.remaining)
  creditors.sort((first, second) => second.remaining - first.remaining)

  // Compensate net debts against credits so indirect chains become direct transfers.
  const settlements = []
  let debtorIndex = 0
  let creditorIndex = 0

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex]
    const creditor = creditors[creditorIndex]
    const amount = Math.min(debtor.remaining, creditor.remaining)

    if (amount > 0) {
      settlements.push({
        id: `${debtor.userId}:${creditor.userId}`,
        debtor: getDisplayName(debtor.userId, memberNames, currentUserId),
        debtorIsCurrentUser: String(debtor.userId) === String(currentUserId),
        creditor: getDisplayName(creditor.userId, memberNames, currentUserId),
        creditorIsCurrentUser: String(creditor.userId) === String(currentUserId),
        amount: amount / 100,
      })
    }

    debtor.remaining -= amount
    creditor.remaining -= amount
    if (debtor.remaining === 0) debtorIndex += 1
    if (creditor.remaining === 0) creditorIndex += 1
  }

  return settlements
}

function GroupDetails({ group, onBack, onMembersUpdated }) {
  const [expenses, setExpenses] = useState([])
  const [payments, setPayments] = useState([])
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(true)
  const [isLoadingPayments, setIsLoadingPayments] = useState(true)
  const [expensesError, setExpensesError] = useState('')
  const [paymentsError, setPaymentsError] = useState('')
  const [isCreatingExpense, setIsCreatingExpense] = useState(false)
  const [isCreatingPayment, setIsCreatingPayment] = useState(false)
  const [isAddingMembers, setIsAddingMembers] = useState(false)
  const [isSimplificationEnabled, setIsSimplificationEnabled] = useState(false)
  const [expenseNotice, setExpenseNotice] = useState('')
  const [memberNotice, setMemberNotice] = useState('')
  const members = group.members ?? []
  const currentUserId = members.find((member) => member.is_current_user)?.user_id
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

  payments.forEach((payment) => {
    const payerId = String(payment.paid_by_id)
    const recipientId = String(payment.paid_to_id)
    const cents = Math.round(Number(payment.amount) * 100)

    if (memberBalances.has(payerId)) {
      memberBalances.set(payerId, memberBalances.get(payerId) + cents)
    }
    if (memberBalances.has(recipientId)) {
      memberBalances.set(recipientId, memberBalances.get(recipientId) - cents)
    }

    const [firstId, secondId] = [payerId, recipientId].sort()
    const pairKey = `${firstId}:${secondId}`
    const debtDirection = payerId === firstId ? 1 : -1
    pairBalances.set(
      pairKey,
      (pairBalances.get(pairKey) ?? 0) - cents * debtDirection,
    )
  })
  const pairwiseDebts = [...pairBalances.entries()]
    .flatMap(([pairKey, balance]) => {
      if (balance === 0) return []
      const [firstId, secondId] = pairKey.split(':')
      const debtorId = balance > 0 ? firstId : secondId
      const creditorId = balance > 0 ? secondId : firstId

      return [{
        id: pairKey,
        debtor: getDisplayName(debtorId, memberNames, currentUserId),
        debtorIsCurrentUser: debtorId === String(currentUserId),
        creditor: getDisplayName(creditorId, memberNames, currentUserId),
        creditorIsCurrentUser: creditorId === String(currentUserId),
        amount: Math.abs(balance) / 100,
      }]
    })
    .sort((first, second) => second.amount - first.amount)
  const displayedDebts = isSimplificationEnabled
    ? simplifySettlements(memberBalances, members, currentUserId)
    : pairwiseDebts
  const formattedCreatedAt = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
  }).format(new Date(group.created_at))

  useEffect(() => {
    let isCurrent = true

    Promise.all([
      apiRequest(`/api/groups/${group.id}/expenses/`),
      apiRequest(`/api/groups/${group.id}/payments/`),
    ])
      .then(([expensesResult, paymentsResult]) => {
        if (isCurrent) {
          setExpenses(expensesResult)
          setPayments(paymentsResult)
          setExpensesError('')
          setPaymentsError('')
        }
      })
      .catch((error) => {
        if (isCurrent) {
          setExpensesError(error.message)
          setPaymentsError(error.message)
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoadingExpenses(false)
          setIsLoadingPayments(false)
        }
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

  function handlePaymentCreated(payment) {
    setPayments((currentPayments) => [payment, ...currentPayments])
    setIsCreatingPayment(false)
    setExpenseNotice('Pagamento registrado com sucesso.')
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

  function handleRetryPayments() {
    setIsLoadingPayments(true)
    setPaymentsError('')
    apiRequest(`/api/groups/${group.id}/payments/`)
      .then(setPayments)
      .catch((error) => setPaymentsError(error.message))
      .finally(() => setIsLoadingPayments(false))
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
            <span className="group-details__metric-label">
              {isSimplificationEnabled ? 'Acertos simplificados' : 'Acertos entre participantes'}
            </span>
            {isLoadingExpenses ? (
              <p role="status">Calculando acertos...</p>
            ) : expensesError ? (
              <p role="alert">Não foi possível carregar os acertos.</p>
            ) : displayedDebts.length ? (
              <ul className="group-details__debt-list">
                {displayedDebts.map((debt) => (
                  <li key={debt.id}>
                    <span>
                      {debt.debtorIsCurrentUser
                        ? <strong className="group-details__debt-you">Você</strong>
                        : debt.debtor} deve
                    </span>
                    <strong>{formatCurrency(debt.amount, group.currency)}</strong>
                    <span>
                      a {debt.creditorIsCurrentUser
                        ? <strong className="group-details__debt-you">Você</strong>
                        : debt.creditor}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Não há valores pendentes entre os participantes.</p>
            )}
          </div>
          <button
            className={`group-details__simplify-button ${isSimplificationEnabled ? 'is-active' : ''}`}
            type="button"
            aria-pressed={isSimplificationEnabled}
            onClick={() => setIsSimplificationEnabled((enabled) => !enabled)}
          >
            <span>Simplificar despesas</span>
            <span className="group-details__toggle" aria-hidden="true">
              <span />
            </span>
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
          <button
            className="group-details__add-expense"
            type="button"
            onClick={() => setIsCreatingPayment(true)}
            style={{ marginTop: '1rem', width: '100%' }}
          >
            <span aria-hidden="true">+</span>
            Registrar pagamento
          </button>
          {isLoadingPayments ? (
            <small role="status" style={{ display: 'block', marginTop: '0.75rem' }}>Carregando pagamentos...</small>
          ) : paymentsError ? (
            <small role="alert" style={{ display: 'block', marginTop: '0.75rem' }}>
              Não foi possível carregar pagamentos.
            </small>
          ) : null}
        </article>
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
          {/* <section className="group-details__balance-summary" aria-labelledby="group-balances-title">
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
          </section> */}
        </section>
      </div>
      {isCreatingExpense && (
        <ExpenseCreationDialog
          group={group}
          onClose={() => setIsCreatingExpense(false)}
          onCreated={handleExpenseCreated}
        />
      )}
      {isCreatingPayment && (
        <PaymentCreationDialog
          group={group}
          onClose={() => setIsCreatingPayment(false)}
          onCreated={handlePaymentCreated}
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
