import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowRight, Bell, CalendarDays, Check, ChevronDown, CircleHelp,
  Gauge, GitBranch, LayoutDashboard, List, MoreHorizontal,
  Plus, Settings, SlidersHorizontal, Sparkles, Target, X, Zap
} from 'lucide-react'

const API_URL = '/api'
const avatarColors = { АА: 'ink', АГ: 'orange', ТВ: 'green', РЗ: 'blue', ДЗ: 'lilac' }
const teamRoles = { АА: 'Frontend', АГ: 'Backend', ТВ: 'Участник разработки', РЗ: 'Backend · DevOps', ДЗ: 'Frontend · Backend' }
const statusLabels = { done: 'Завершено', progress: 'В работе', planned: 'Запланировано' }

function App() {
  const [project, setProject] = useState(null)
  const [error, setError] = useState('')
  const [view, setView] = useState('timeline')
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showScenario, setShowScenario] = useState(false)
  const [delay, setDelay] = useState(2)
  const [dependencyVisible, setDependencyVisible] = useState(true)
  const [toast, setToast] = useState('')

  useEffect(() => {
    fetch(`${API_URL}/projects/1`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('API unavailable')))
      .then(setProject)
      .catch(() => setError('API недоступен. Показаны демонстрационные данные.'))
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(timer)
  }, [toast])

  const tasks = project?.tasks ?? []
  const affectedTasks = delay > 0 ? 3 : 0
  const team = [...new Map(tasks.map((task) => [task.initials, task])).values()]
  const timelineTasks = useMemo(() => tasks.map((task) => ({ ...task, end: task.start_day + task.duration })), [tasks])

  const openScenario = () => setShowScenario(true)
  const applyScenario = async () => {
    try {
      await fetch(`${API_URL}/projects/1/simulate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task_id: 'design', delay_days: delay })
      })
    } catch { /* Demo mode still works without the API. */ }
    setShowScenario(false)
    setToast(delay ? `Сценарий применен: проект сдвинется на ${delay} дн.` : 'Сценарий применен: срок проекта сохранен')
  }

  return <div className="app-shell">
    <Sidebar team={team} />
    <main className="main-content">
      <header className="topbar"><div className="breadcrumbs"><span>Проекты</span><span>/</span><strong>{project?.name ?? 'Редизайн сайта'}</strong></div><div className="top-actions"><button className="icon-button" aria-label="Уведомления"><Bell size={17} /><i /></button><button className="help-button" aria-label="Помощь"><CircleHelp size={14} /></button></div></header>
      <div className="content-wrap" id="overview">
        <section className="page-heading"><div><div className="eyebrow"><span className="status-dot" />{project?.status ?? 'В работе'} <span className="heading-separator">·</span> обновлено {project?.updated ?? '12 минут назад'}</div><h1>{project?.name ?? 'Редизайн сайта'}</h1><p>План, команда и последствия изменений — на одном экране.</p></div><div className="heading-actions"><button className="secondary-button" onClick={openScenario}><Sparkles size={14} /> Проверить изменение</button><button className="primary-button" onClick={() => setShowTaskModal(true)}><Plus size={16} /> Новая задача</button></div></section>
        {error && <div className="api-note"><Zap size={14} /> {error}</div>}
        <Metrics project={project} affectedTasks={affectedTasks} />
        <section className="dashboard-grid">
          <Timeline tasks={timelineTasks} view={view} setView={setView} dependencyVisible={dependencyVisible} setDependencyVisible={setDependencyVisible} />
          <aside className="side-column"><Attention openScenario={openScenario} /><article className="panel decision-panel"><div className="decision-badge">КОНТРОЛЬНАЯ ТОЧКА</div><h2>Что изменится,<br /><em>если опоздать?</em></h2><p>Измените срок задачи и сразу увидите влияние на проект.</p><button className="outline-button" onClick={openScenario}>Запустить сценарий <ArrowRight size={14} /></button></article></aside>
        </section>
        <section className="bottom-grid"><Activity /><Health /></section>
      </div>
    </main>
    {showTaskModal && <TaskModal close={() => setShowTaskModal(false)} onSave={(name) => { setShowTaskModal(false); setToast(`Задача «${name}» добавлена`) }} />}
    {showScenario && <ScenarioModal delay={delay} setDelay={setDelay} affectedTasks={affectedTasks} close={() => setShowScenario(false)} apply={applyScenario} />}
    <div className={`toast ${toast ? 'show' : ''}`} role="status">{toast}</div>
  </div>
}

function Sidebar({ team }) {
  return <aside className="sidebar"><div className="brand"><span className="brand-mark">c</span><span>critix</span></div><div className="workspace-label">РАБОЧЕЕ ПРОСТРАНСТВО</div><button className="project-switcher"><span className="project-dot" /><span><strong>Редизайн сайта</strong><small>Digital Lab</small></span><ChevronDown size={15} /></button><nav className="main-nav"><a className="nav-item active" href="#overview"><LayoutDashboard size={16} />Обзор</a><a className="nav-item" href="#timeline"><GitBranch size={16} />План проекта</a><a className="nav-item" href="#tasks"><Check size={16} />Задачи<span className="nav-count">8</span></a><a className="nav-item" href="#risks"><AlertTriangle size={16} />Риски<span className="nav-count warning">3</span></a></nav><div className="sidebar-divider" /><div className="workspace-label">КОМАНДА</div><div className="team-stack">{team.map((person) => <span key={person.initials} title={`${person.owner} · ${teamRoles[person.initials]}`} className={`avatar avatar-${avatarColors[person.initials] ?? 'blue'}`}>{person.initials}</span>)}<button className="avatar add-person"><Plus size={14} /></button></div><div className="workspace-label team-caption">5 участников · роли распределены</div><div className="sidebar-bottom"><a className="nav-item" href="#settings"><Settings size={16} />Настройки</a><div className="user-card"><span className="avatar avatar-ink">АА</span><span><strong>Александра Антипова</strong><small>Frontend-разработчик</small></span><MoreHorizontal size={15} /></div></div></aside>
}

function Metrics({ project, affectedTasks }) {
  const metrics = [{ label: 'Прогресс проекта', value: `${project?.progress ?? 64}%`, icon: Gauge, tone: 'purple', foot: '16 из 25 дней', trend: '+8% за неделю' }, { label: 'До завершения', value: '9', unit: 'дней', icon: CalendarDays, tone: 'blue', foot: 'Финиш 24 октября 2024' }, { label: 'Задачи под угрозой', value: '3', icon: AlertTriangle, tone: 'coral', foot: `${affectedTasks || 2} требуют внимания сегодня` }, { label: 'Критический путь', value: '5', unit: 'задач', icon: Target, tone: 'green', foot: 'Максимальная задержка 2 дн.' }]
  return <section className="metric-grid">{metrics.map(({ label, value, unit, icon: Icon, tone, foot, trend }) => <article className="metric-card" key={label}><div className="metric-top"><span className="metric-label">{label}</span><span className={`metric-icon ${tone}`}><Icon size={15} /></span></div><div className={`metric-value ${tone === 'coral' ? 'coral-text' : ''}`}>{value} {unit && <small>{unit}</small>}</div>{tone === 'purple' && <div className="progress-track"><span style={{ width: `${project?.progress ?? 64}%` }} /></div>}<div className="metric-foot"><span>{foot}</span>{trend ? <span className="positive">{trend}</span> : <span className="metric-symbol">{tone === 'coral' ? '!' : tone === 'green' ? '↗' : '▣'}</span>}</div></article>)}</section>
}

function Timeline({ tasks, view, setView, dependencyVisible, setDependencyVisible }) {
  return <article className="panel timeline-panel" id="timeline"><div className="panel-header"><div><h2>План проекта</h2><p>Последовательность работ и зависимости</p></div><div className="view-tabs"><button className={`view-tab ${view === 'timeline' ? 'active' : ''}`} onClick={() => setView('timeline')}>Timeline</button><button className={`view-tab ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}><List size={12} /> Список</button></div></div><div className="timeline-toolbar"><div className="legend"><span><i className="legend-dot done" />Завершено</span><span><i className="legend-dot progress" />В работе</span><span><i className="legend-dot planned" />Запланировано</span><span><i className="legend-dot critical" />Критический путь</span></div><button className="filter-button"><SlidersHorizontal size={12} /> Все статусы <ChevronDown size={12} /></button></div>{view === 'timeline' ? <TimelineView tasks={tasks} dependencyVisible={dependencyVisible} /> : <ListView tasks={tasks} />}<div className="timeline-footer"><span>Сегодня, 15 октября</span><span className="today-line" /><span>Показать зависимости <button className={`toggle ${dependencyVisible ? 'active' : ''}`} onClick={() => setDependencyVisible(!dependencyVisible)}><span /></button></span></div></article>
}

function TimelineView({ tasks, dependencyVisible }) {
  return <div className="timeline"><div className="timeline-head"><div className="task-heading">ЗАДАЧА</div><div className="date-heading">ОКТЯБРЬ 2024<div className="dates">{['07', '09', '11', '13', '15', '17', '19', '21', '23'].map((date) => <span key={date}>{date}</span>)}</div></div></div>{tasks.map((task) => <div className="task-row" key={task.id}><div className="task-info"><span className={`avatar mini-avatar avatar-${avatarColors[task.initials] ?? 'blue'}`}>{task.initials}</span><div><span className="task-name">{task.title}</span><span className="task-meta"><i className={`task-status-dot ${task.status}`} />{statusLabels[task.status]} · {task.duration} дн.</span></div></div><div className="task-chart"><span className={`task-bar ${task.status} ${task.critical ? 'critical' : ''}`} style={{ left: `${task.start_day * 3.7}%`, width: `${task.duration * 3.7}%` }}>{task.duration > 2 && `${task.duration} дн.`}</span>{dependencyVisible && task.dependency && <span className="task-connector" />}{task.id === 'design' && <span className="today-marker" />}</div></div>)}</div>
}
function ListView({ tasks }) { return <div className="list-view">{tasks.map((task) => <div className="list-row" key={task.id}><strong>{task.title}</strong><small>{task.owner}</small><small>{statusLabels[task.status]}</small></div>)}</div> }

function Attention({ openScenario }) {
  return <article className="panel attention-panel" id="risks"><div className="panel-header"><div><h2>Требует внимания</h2><p>Изменения и риски проекта</p></div><button className="round-action"><ArrowRight size={17} /></button></div><div className="attention-list"><AttentionItem tone="high" icon={AlertTriangle} title="Сдвиг критического пути" text="«Дизайн интерфейса» задержан на 2 дня" action="Разобраться" onClick={openScenario} time="2 ч" /><AttentionItem tone="medium" icon={ArrowRight} title="Зависимая задача под угрозой" text="«Разработка» начнется с опозданием" action="Посмотреть" onClick={openScenario} time="вчера" /><AttentionItem tone="neutral" icon={Check} title="Готово к проверке" text="«Прототипирование» ожидает вашего решения" action="Открыть" onClick={openScenario} time="вчера" /></div></article>
}
function AttentionItem({ tone, icon: Icon, title, text, action, onClick, time }) { return <div className={`attention-item ${tone}`}><span className="attention-icon"><Icon size={13} /></span><div><strong>{title}</strong><p>{text}</p><button className="text-action" onClick={onClick}>{action} <ArrowRight size={10} /></button></div><span className="time">{time}</span></div> }
function Activity() { return <article className="panel activity-panel" id="tasks"><div className="panel-header"><div><h2>Последние изменения</h2><p>Что команда поменяла в проекте</p></div><MoreHorizontal size={17} color="#a6aeba" /></div><ActivityRow initials="АА" color="ink" name="Александра Антипова" text="обновила срок задачи «Дизайн интерфейса»" time="Сегодня, 11:42" change="15 → 17 окт." /><ActivityRow initials="АГ" color="orange" name="Антон Гасников" text="завершил задачу «Анализ конкурентов»" time="Сегодня, 09:18" change="Завершено" done /><ActivityRow initials="РЗ" color="blue" name="Радмир Зубаеров" text="проверил зависимости перед деплоем" time="Вчера, 18:30" change="Проверено" /></article> }
function ActivityRow({ initials, color, name, text, time, change, done }) { return <div className="activity-row"><span className={`avatar avatar-${color}`}>{initials}</span><div><strong>{name}</strong> <span>{text}</span><small>{time}</small></div><span className={`activity-change ${done ? 'done-change' : ''}`}>{change}</span></div> }
function Health() { return <article className="panel health-panel"><div className="panel-header"><div><h2>Состояние проекта</h2><p>Текущая оценка сроков и команды</p></div><span className="health-status">В норме</span></div><div className="health-score"><div className="score-ring"><span>78</span><small>/ 100</small></div><div><strong>Можно продолжать по плану</strong><p>Нужна короткая проверка двух задач перед разработкой.</p></div></div><div className="health-bars">{[['Сроки', 82], ['Зависимости', 74], ['Команда', 91]].map(([label, score]) => <div key={label}><span>{label}</span><i><b style={{ width: `${score}%` }} /></i><strong>{score}</strong></div>)}</div></article> }

function TaskModal({ close, onSave }) { const [name, setName] = useState(''); return <Modal close={close}><div className="modal-header"><div><span className="modal-kicker">ПЛАН ПРОЕКТА</span><h2>Новая задача</h2></div><button className="close-button" onClick={close}><X size={17} /></button></div><form onSubmit={(event) => { event.preventDefault(); onSave(name || 'Новая задача') }}><label>Что нужно сделать?<input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Например, Подготовить контент" /></label><div className="form-grid"><label>Кто ведет<select><option>Александра · Frontend</option><option>Антон · Backend</option><option>Радмир · Backend · DevOps</option><option>Дима · Frontend · Backend</option></select></label><label>Статус<select><option>Запланировано</option><option>В работе</option><option>Завершено</option></select></label></div><div className="form-grid"><label>Начало<input type="date" defaultValue="2024-10-21" /></label><label>Дедлайн<input type="date" defaultValue="2024-10-24" /></label></div><label>Начинается после<select><option>Без зависимости</option><option>Дизайн интерфейса</option><option>Прототипирование</option></select></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={close}>Отмена</button><button className="primary-button" type="submit">Добавить задачу</button></div></form></Modal> }
function ScenarioModal({ delay, setDelay, affectedTasks, close, apply }) { return <Modal close={close}><div className="modal-header"><div><span className="modal-kicker">ПРОВЕРКА ИЗМЕНЕНИЯ</span><h2>Что если?</h2></div><button className="close-button" onClick={close}><X size={17} /></button></div><p className="modal-intro">Проверьте последствия до того, как менять план проекта.</p><div className="scenario-task"><span className="avatar avatar-ink">АА</span><div><strong>Дизайн интерфейса</strong><small>Александра Антипова · Frontend · критический путь</small></div><span className="risk-pill">Под угрозой</span></div><label className="range-label">Задержка задачи <strong>{delay} {delay === 1 ? 'день' : 'дня'}</strong><input type="range" min="0" max="5" value={delay} onChange={(event) => setDelay(Number(event.target.value))} /></label><div className="scenario-result"><div className="result-label">ПОСЛЕДСТВИЯ ИЗМЕНЕНИЯ</div><div className="result-row"><span><i className="result-icon red"><ArrowRight size={12} /></i>Срок проекта сдвинется</span><strong>на {delay} дн.</strong></div><div className="result-row"><span><i className="result-icon amber"><AlertTriangle size={12} /></i>Затронутые задачи</span><strong>{affectedTasks} задачи</strong></div><div className="result-row"><span><i className="result-icon blue"><GitBranch size={12} /></i>Потребуется решение</span><strong>{delay ? 'Да' : 'Нет'}</strong></div></div><div className="scenario-note"><span>i</span><p>Можно ускорить «Разработку», подключив Дмитрия к backend-части. Это сохранит первоначальный срок проекта.</p></div><div className="modal-actions"><button className="secondary-button" onClick={() => setDelay(0)}>Сбросить</button><button className="primary-button" onClick={apply}>Применить сценарий</button></div></Modal> }
function Modal({ children, close }) { return <div className="modal-backdrop open" onMouseDown={(event) => event.target === event.currentTarget && close()}><div className="modal">{children}</div></div> }

export default App
