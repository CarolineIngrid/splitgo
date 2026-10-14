import { useState } from 'react'

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

function GroupDetails({ group, onBack }) {
  const [expenseNotice, setExpenseNotice] = useState('')
  const members = group.members ?? []
  const formattedCreatedAt = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
  }).format(new Date(group.created_at))

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
            <p className="">DETALHES DO GRUPO</p>
            <h1>{group.name}</h1>
            <p>Criado em {formattedCreatedAt}</p>
          </div>
        </div>
        <span className="group-details__currency">{group.currency}</span>
      </header>

      <section className="group-details__summary" aria-label="Resumo do grupo">
        <article className="group-details__metric group-details__metric--purple">
          <span className="group-details__metric-label">Total de despesas</span>
          <strong>{formatCurrency(0, group.currency)}</strong>
          <small>Nenhuma despesa registrada</small>
        </article>
        <article className="group-details__metric group-details__metric--peach">
          <span className="group-details__metric-label">Despesas</span>
          <strong>0</strong>
          <small>lançamentos no grupo</small>
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
              <span className="group-details__section-count">0</span>
              <button
                className="group-details__add-expense"
                type="button"
                onClick={() => setExpenseNotice('A inclusão de despesas estará disponível em breve.')}
              >
                <span aria-hidden="true">+</span>
                Adicionar despesa
              </button>
            </div>
          </div>
          <div className="group-details__empty">
            <span className="group-details__empty-icon" aria-hidden="true">$</span>
            <strong>Nenhuma despesa por enquanto</strong>
            <p>Quando uma despesa for adicionada, você poderá acompanhar o valor e como será dividido entre os participantes.</p>
          </div>
          {expenseNotice && <p className="group-details__expense-notice" role="status">{expenseNotice}</p>}
        </section>

        <section className="group-details__panel" aria-labelledby="group-members-title">
          <div className="group-details__section-heading">
            <div>
              <h2 id="group-members-title">Participantes</h2>
              <p>Pessoas que fazem parte deste grupo.</p>
            </div>
            <span className="group-details__section-count">{members.length}</span>
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
        </section>
      </div>
    </div>
  )
}

export default GroupDetails
