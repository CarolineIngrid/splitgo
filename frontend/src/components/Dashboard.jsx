import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../lib/api.js'
import GroupCreationDialog from './GroupCreationDialog.jsx'
import GroupDetails from './GroupDetails.jsx'
import './Dashboard.css'

const navigation = [
  { id: 'inicio', label: 'Visão geral', icon: 'grid' },
  { id: 'grupos', label: 'Grupos', icon: 'users' },
  { id: 'despesas', label: 'Despesas', icon: 'receipt' },
]

const sectionCopy = {
  inicio: {
    eyebrow: 'SEU RESUMO',
    title: 'Visão geral',
    description: 'Acompanhe seus grupos e mantenha as despesas em dia.',
  },
  grupos: {
    eyebrow: 'SUA ORGANIZAÇÃO',
    title: 'Seus grupos',
    description: 'Viagens, casa, eventos: organize cada conta em conjunto.',
  },
  despesas: {
    eyebrow: 'ACOMPANHAMENTO',
    title: 'Suas despesas',
    description: 'Veja os gastos compartilhados e acompanhe cada acerto.',
  },
}

function Icon({ name, size = 20 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    receipt: <><path d="M4 3v18l3-2 3 2 3-2 3 2 4-2V3l-4 2-3-2-3 2-3-2-3 2Z" /><path d="M8 9h8M8 13h6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" /></>,
  }

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

function Brand() {
  return (
    <div className="dashboard-brand" aria-label="Split and Go">
      <img className="dashboard-brand__logo" src="/cat.png" alt="" />
      <span>split <strong>&amp; go</strong></span>
    </div>
  )
}

function EmptyState({ section, onCreateGroup, onViewGroups }) {
  const isOverview = section === 'inicio'
  const isGroups = section === 'grupos'
  const isExpenses = section === 'despesas'

  return (
    <section className="dashboard-empty" aria-labelledby="empty-title">
      <div className="dashboard-empty__illustration" aria-hidden="true">
        <span className="empty-orbit empty-orbit--one" />
        <span className="empty-orbit empty-orbit--two" />
        <div className="empty-card empty-card--back"><Icon name="receipt" size={22} /></div>
        <div className="empty-card empty-card--front"><Icon name="users" size={25} /></div>
        <span className="empty-spark"><Icon name="spark" size={19} /></span>
      </div>
      <p className="dashboard-eyebrow">
        {isOverview ? 'TUDO COMEÇA POR AQUI' : isGroups ? 'PLANOS COMPARTILHADOS' : 'CONTROLE SEM COMPLICAÇÃO'}
      </p>
      <h2 id="empty-title">
        {isOverview ? 'Seu próximo momento começa junto.' : isGroups ? 'Ainda não há grupos por aqui.' : 'Suas despesas aparecerão aqui.'}
      </h2>
      <p className="dashboard-empty__description">
        {isOverview
          ? 'Crie um grupo para dividir os gastos da próxima viagem, do jantar ou da casa.'
          : isGroups
            ? 'Reúna as pessoas e organize os gastos de cada plano em um só lugar.'
            : 'Quando você adicionar um gasto a um grupo, poderá acompanhar tudo por aqui.'}
      </p>
      {isExpenses ? (
        <button className="dashboard-button dashboard-button--outline" type="button" onClick={onViewGroups}>
          <Icon name="users" size={18} />
          Ver meus grupos
        </button>
      ) : (
        <button className="dashboard-button dashboard-button--primary" type="button" onClick={onCreateGroup}>
          <Icon name="plus" size={18} />
          Criar meu primeiro grupo
        </button>
      )}
      {!isExpenses && <span className="dashboard-empty__note">Grupos e despesas serão salvos na sua conta.</span>}
    </section>
  )
}

function Dashboard({ user, onLogout }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [activeSection, setActiveSection] = useState('inicio')
  const [notice, setNotice] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [groups, setGroups] = useState([])
  const [isLoadingGroups, setIsLoadingGroups] = useState(true)
  const [groupsError, setGroupsError] = useState('')
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const currentSection = sectionCopy[activeSection]
  const firstName = user.name.trim().split(/\s+/)[0]
  const initials = user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  useEffect(() => {
    let isCurrent = true

    apiRequest('/api/groups/')
      .then((result) => {
        if (!isCurrent) return
        setGroups(result)
        setGroupsError('')
      })
      .catch((error) => {
        if (isCurrent) setGroupsError(error.message)
      })
      .finally(() => {
        if (isCurrent) setIsLoadingGroups(false)
      })

    return () => {
      isCurrent = false
    }
  }, [])

  async function handleLogout() {
    setIsLoggingOut(true)
    setLogoutError('')
    try {
      await apiRequest('/api/auth/logout/', { method: 'POST' })
      onLogout()
    } catch (error) {
      setLogoutError(error.message)
      setIsLoggingOut(false)
    }
  }

  const handleCreateGroup = useCallback(() => {
    setNotice('')
    setActiveSection('grupos')
    setIsCreatingGroup(true)
  }, [])

  const closeGroupDialog = useCallback(() => {
    setIsCreatingGroup(false)
  }, [])

  function handleRetryGroups() {
    setIsLoadingGroups(true)
    setGroupsError('')
    apiRequest('/api/groups/')
      .then((result) => setGroups(result))
      .catch((error) => setGroupsError(error.message))
      .finally(() => setIsLoadingGroups(false))
  }

  function handleGroupCreated(group) {
    setGroups((currentGroups) => [group, ...currentGroups])
    setIsCreatingGroup(false)
    setActiveSection('grupos')
    setSelectedGroup(group)
    setNotice(`Grupo “${group.name}” criado com sucesso.`)
  }

  function handleGroupMembersUpdated(members) {
    setSelectedGroup((currentGroup) => currentGroup
      ? { ...currentGroup, members }
      : currentGroup)
    setGroups((currentGroups) => currentGroups.map((group) => (
      group.id === selectedGroup?.id ? { ...group, members } : group
    )))
  }

  return (
    <main className={`dashboard ${isSidebarCollapsed ? 'dashboard--sidebar-collapsed' : ''}`}>
      <aside className="dashboard-sidebar" aria-label="Menu principal">
        <div className="dashboard-sidebar__header">
          <Brand />
          <button
            className="sidebar-toggle"
            type="button"
            aria-label={isSidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            aria-expanded={!isSidebarCollapsed}
            title={isSidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {isSidebarCollapsed
                ? <path d="m9 18 6-6-6-6" />
                : <path d="m15 18-6-6 6-6" />}
            </svg>
          </button>
        </div>
        <div className="dashboard-workspace">
          <span className="workspace-avatar">S</span>
          <span><strong>Meu espaço</strong><small>Área pessoal</small></span>
        </div>

        <p className="dashboard-nav-label">MENU</p>
        <nav className="dashboard-nav" aria-label="Navegação">
          {navigation.map((item) => (
            <button
              className={`dashboard-nav__item ${activeSection === item.id ? 'is-active' : ''}`}
              key={item.id}
              type="button"
              aria-current={activeSection === item.id ? 'page' : undefined}
              title={isSidebarCollapsed ? item.label : undefined}
              aria-label={isSidebarCollapsed ? item.label : undefined}
              onClick={() => {
                setActiveSection(item.id)
                setSelectedGroup(null)
                setNotice('')
              }}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
              {item.id === 'grupos' && <span className="dashboard-nav__count">{groups.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-tip">
          <span className="sidebar-tip__icon"><Icon name="spark" size={17} /></span>
          <strong>Dividir fica mais leve</strong>
          <p>Organize os gastos e aproveite mais cada momento.</p>
        </div>

        <button
          className="sidebar-account"
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          aria-label="Sair da conta"
        >
          <span className="user-avatar">{initials}</span>
          <span className="sidebar-account__detail"><strong>{user.name}</strong><small>{user.email}</small></span>
          <Icon name="logout" size={17} />
        </button>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="dashboard-breadcrumb"><span>Meu espaço</span><span>/</span><strong>{selectedGroup?.name ?? currentSection.title}</strong></div>
          <div className="dashboard-topbar__actions">
            <span className="dashboard-date">
              {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date())}
            </span>
            <button
              className="icon-button"
              type="button"
              aria-label="Notificações"
              onClick={() => setNotice('Você está em dia. Nenhuma notificação por enquanto.')}
            >
              <Icon name="bell" size={19} />
              <span className="notification-dot" />
            </button>
          </div>
        </header>

        <div className="dashboard-content">
          {notice && <p className="dashboard-notice" role="status">{notice}</p>}
          {selectedGroup ? (
            <GroupDetails
              key={selectedGroup.id}
              group={selectedGroup}
              onBack={() => setSelectedGroup(null)}
              onMembersUpdated={handleGroupMembersUpdated}
            />
          ) : (
            <>
          <div className="dashboard-welcome">
            <div>
              <p className="dashboard-eyebrow">{currentSection.eyebrow}</p>
              <h1>{activeSection === 'inicio' ? `Olá, ${firstName}!` : currentSection.title}</h1>
              <p className="dashboard-welcome__description">
                {activeSection === 'inicio' ? 'Pronto para deixar as contas mais leves?' : currentSection.description}
              </p>
              {activeSection === 'inicio' && (
                <span className="dashboard-holo-divider" aria-hidden="true" />
              )}
            </div>
            <button className="dashboard-button dashboard-button--outline" type="button" onClick={handleCreateGroup}>
              <Icon name="plus" size={18} />
              Novo grupo
            </button>
          </div>

          <section className="balance-overview" aria-label="Resumo dos seus saldos">
            <article className="balance-tile balance-tile--purple">
              <span className="balance-tile__icon"><Icon name="arrow" size={18} /></span>
              <span className="balance-tile__label">Você tem a pagar</span>
              <strong>R$ 0,00</strong>
              <span className="balance-tile__caption">Nenhuma pendência por enquanto</span>
            </article>
            <article className="balance-tile balance-tile--green">
              <span className="balance-tile__icon"><Icon name="check" size={18} /></span>
              <span className="balance-tile__label">Você tem a receber</span>
              <strong>R$ 0,00</strong>
              <span className="balance-tile__caption">Seus acertos aparecerão aqui</span>
            </article>
            <article className="balance-tile balance-tile--peach">
              <span className="balance-tile__icon"><Icon name="receipt" size={18} /></span>
              <span className="balance-tile__label">Grupos ativos</span>
              <strong>{isLoadingGroups ? '—' : groups.length}</strong>
              <span className="balance-tile__caption">{groups.length === 1 ? 'grupo criado' : 'grupos criados'}</span>
            </article>
          </section>

          <section className="dashboard-groups" aria-labelledby="groups-heading">
            <div className="dashboard-section-heading">
              <div>
                <h2 id="groups-heading">{activeSection === 'despesas' ? 'Atividade recente' : 'Seus grupos'}</h2>
                <p>Despesas compartilhadas, sem complicação.</p>
              </div>
              <button className="text-button" type="button" onClick={() => setActiveSection('grupos')}>
                Ver grupos <span aria-hidden="true">→</span>
              </button>
            </div>
            {activeSection === 'despesas' ? (
              <EmptyState
                section={activeSection}
                onCreateGroup={handleCreateGroup}
                onViewGroups={() => setActiveSection('grupos')}
              />
            ) : isLoadingGroups ? (
              <p className="dashboard-list-message" role="status">Carregando seus grupos...</p>
            ) : groupsError ? (
              <div className="dashboard-list-message dashboard-list-message--error" role="alert">
                <span>{groupsError}</span>
                <button className="text-button" type="button" onClick={handleRetryGroups}>Tentar novamente</button>
              </div>
            ) : groups.length === 0 ? (
              <EmptyState section={activeSection} onCreateGroup={handleCreateGroup} />
            ) : (
              <div className="group-list">
                {groups.map((group) => (
                  <button
                    className="group-card"
                    key={group.id}
                    type="button"
                    onClick={() => {
                      setSelectedGroup(group)
                      setActiveSection('grupos')
                      setNotice('')
                    }}
                    aria-label={`Abrir grupo ${group.name}`}
                  >
                    <span className="group-card__icon">
                      <img src="/cat.png" alt="" />
                    </span>
                    <span className="group-card__details">
                      <strong>{group.name}</strong>
                      <small>{group.role === 'admin' ? 'Administrador' : 'Integrante'} · Criado em {new Intl.DateTimeFormat('pt-BR').format(new Date(group.created_at))}</small>
                    </span>
                    <span className="group-card__currency">{group.currency}</span>
                    <span className="group-card__arrow" aria-hidden="true">›</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {logoutError && <p className="dashboard-error" role="alert">{logoutError}</p>}
            </>
          )}
        </div>

        <footer className="dashboard-footer">
          <span>© 2026 Split and Go</span>
        </footer>
      </section>

      <nav className="dashboard-mobile-nav" aria-label="Navegação principal">
        {navigation.map((item) => (
          <button
            className={activeSection === item.id ? 'is-active' : ''}
            key={item.id}
            type="button"
            aria-current={activeSection === item.id ? 'page' : undefined}
            onClick={() => {
              setActiveSection(item.id)
              setSelectedGroup(null)
              setNotice('')
            }}
          >
            <Icon name={item.icon} size={19} />
            <span>{item.label}</span>
          </button>
        ))}
        <button type="button" onClick={handleLogout} disabled={isLoggingOut}>
        <Icon name="logout" size={19} />
        <span>Sair</span>
        </button>
      </nav>
      {isCreatingGroup && (
        <GroupCreationDialog
          onClose={closeGroupDialog}
          onCreated={handleGroupCreated}
        />
      )}
    </main>
  )
}

export default Dashboard
