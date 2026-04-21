const weekdays = [
  { key: 1, label: 'Mon' },
  { key: 2, label: 'Tue' },
  { key: 3, label: 'Wed' },
  { key: 4, label: 'Thu' },
  { key: 5, label: 'Fri' },
  { key: 6, label: 'Sat' },
  { key: 0, label: 'Sun' }
]

const state = {
  templateName: 'Operator Sessions Daily Export',
  questionUrl: 'https://metabase-dev.shargethailand.com/question/45',
  filePattern: 'operator_sessions_{{run_date}}.xlsx',
  scheduleEnabled: true,
  frequency: 'daily',
  startDate: '2026-04-03',
  runTime: '07:00',
  timezone: 'Asia/Bangkok',
  monthlyDay: '1',
  selectedWeekdays: [1, 3, 5],
  emailSubject: '[DEV] Operator Sessions - {{run_date}}',
  emailBody: `Hello team,

Please find the attached report for {{run_date}}.

Regards,
Report Studio`,
  recipients: ['ops@sharge.co', 'finance@sharge.co']
}

const templateNameInput = document.getElementById('template-name')
const questionUrlInput = document.getElementById('question-url')
const filePatternInput = document.getElementById('file-pattern')
const startDateInput = document.getElementById('start-date')
const runTimeInput = document.getElementById('run-time')
const timezoneInput = document.getElementById('timezone')
const monthlyDayInput = document.getElementById('monthly-day')
const emailSubjectInput = document.getElementById('email-subject')
const emailBodyInput = document.getElementById('email-body')
const recipientInput = document.getElementById('recipient-input')
const scheduleEnabledInput = document.getElementById('schedule-enabled')
const frequencyControl = document.getElementById('frequency-control')
const weekdayListNode = document.getElementById('weekday-list')
const recipientListNode = document.getElementById('recipient-list')

const previewTitle = document.getElementById('preview-title')
const previewFilename = document.getElementById('preview-filename')
const previewSource = document.getElementById('preview-source')
const previewSchedule = document.getElementById('preview-schedule')
const previewRecipients = document.getElementById('preview-recipients')
const previewEmailSubject = document.getElementById('preview-email-subject')
const upcomingRunsNode = document.getElementById('upcoming-runs')

const monthlyDayField = document.getElementById('monthly-day-field')
const weekdayPanel = document.getElementById('weekday-panel')
const schedulePanel = scheduleEnabledInput.closest('.panel')
const toastNode = document.getElementById('toast')

function getQuestionId() {
  const match = state.questionUrl.match(/\/question\/(\d+)/i) ?? state.questionUrl.match(/\/card\/(\d+)/i)
  return match?.[1] ?? '-'
}

function buildScheduleSummary() {
  if (!state.scheduleEnabled) {
    return 'Manual run only.'
  }

  if (state.frequency === 'daily') {
    return `Daily from ${state.startDate} at ${state.runTime} (${state.timezone})`
  }

  if (state.frequency === 'weekly') {
    const labels = weekdays
      .filter(day => state.selectedWeekdays.includes(day.key))
      .map(day => day.label)
      .join(', ')

    return `Weekly on ${labels || 'selected days'} from ${state.startDate} at ${state.runTime} (${state.timezone})`
  }

  return `Monthly on day ${state.monthlyDay} from ${state.startDate} at ${state.runTime} (${state.timezone})`
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function nextRuns() {
  if (!state.scheduleEnabled) {
    return []
  }

  const [hour, minute] = state.runTime.split(':').map(Number)
  const now = new Date()
  const start = new Date(`${state.startDate}T${state.runTime}:00`)
  const runs = []

  if (state.frequency === 'daily') {
    for (let offset = 0; runs.length < 3; offset += 1) {
      const candidate = new Date(start)
      candidate.setDate(start.getDate() + offset)
      candidate.setHours(hour, minute, 0, 0)
      if (candidate > now) {
        runs.push(candidate)
      }
    }
    return runs
  }

  if (state.frequency === 'weekly') {
    for (let offset = 0; runs.length < 3 && offset < 28; offset += 1) {
      const candidate = new Date(start)
      candidate.setDate(start.getDate() + offset)
      candidate.setHours(hour, minute, 0, 0)
      if (candidate > now && state.selectedWeekdays.includes(candidate.getDay())) {
        runs.push(candidate)
      }
    }
    return runs
  }

  let year = start.getFullYear()
  let month = start.getMonth()

  while (runs.length < 3) {
    const day = Math.min(Number(state.monthlyDay), daysInMonth(year, month))
    const candidate = new Date(year, month, day, hour, minute, 0, 0)
    if (candidate > now) {
      runs.push(candidate)
    }
    month += 1
    if (month > 11) {
      month = 0
      year += 1
    }
  }

  return runs
}

function renderWeekdays() {
  weekdayListNode.innerHTML = weekdays.map(day => `
    <button type="button" class="weekday-pill ${state.selectedWeekdays.includes(day.key) ? 'weekday-pill-active' : ''}" data-weekday="${day.key}">
      ${day.label}
    </button>
  `).join('')
}

function renderRecipients() {
  recipientListNode.innerHTML = state.recipients.map((recipient, index) => `
    <div class="recipient-chip">
      <span>${recipient}</span>
      <button type="button" class="chip-remove" data-recipient-index="${index}">x</button>
    </div>
  `).join('')
}

function renderUpcomingRuns() {
  const runs = nextRuns()

  if (runs.length === 0) {
    upcomingRunsNode.innerHTML = '<div class="run-meta">No automatic runs</div>'
    return
  }

  upcomingRunsNode.innerHTML = runs.map(run => `
    <div class="run-item">
      <div>
        <div class="run-date">${run.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
        <div class="run-meta">${run.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </div>
  `).join('')
}

function renderSummary() {
  previewTitle.textContent = state.templateName
  previewSource.textContent = `${state.questionUrl} (Question #${getQuestionId()})`
  previewFilename.textContent = state.filePattern
  previewSchedule.textContent = buildScheduleSummary()
  previewRecipients.textContent = state.recipients.length
    ? state.recipients.join(', ')
    : 'No recipients'
  previewEmailSubject.textContent = state.emailSubject
}

function renderScheduleVisibility() {
  schedulePanel.classList.toggle('schedule-disabled', !state.scheduleEnabled)
  monthlyDayField.classList.toggle('monthly-hidden', state.frequency !== 'monthly')
  weekdayPanel.classList.toggle('weekly-hidden', state.frequency !== 'weekly')
}

function updateSelectedSegments() {
  frequencyControl.querySelectorAll('.segment').forEach(node => {
    node.classList.toggle('segment-active', node.dataset.frequency === state.frequency)
  })
}

function renderAll() {
  templateNameInput.value = state.templateName
  questionUrlInput.value = state.questionUrl
  filePatternInput.value = state.filePattern
  startDateInput.value = state.startDate
  runTimeInput.value = state.runTime
  timezoneInput.value = state.timezone
  monthlyDayInput.value = state.monthlyDay
  emailSubjectInput.value = state.emailSubject
  emailBodyInput.value = state.emailBody
  scheduleEnabledInput.checked = state.scheduleEnabled

  renderWeekdays()
  renderRecipients()
  renderSummary()
  renderUpcomingRuns()
  renderScheduleVisibility()
  updateSelectedSegments()
}

function showToast(message) {
  toastNode.textContent = message
  toastNode.classList.add('toast-visible')
  window.clearTimeout(showToast.timer)
  showToast.timer = window.setTimeout(() => {
    toastNode.classList.remove('toast-visible')
  }, 2200)
}

function addRecipient() {
  const email = recipientInput.value.trim()
  if (!email) {
    return
  }

  if (!state.recipients.includes(email)) {
    state.recipients = [...state.recipients, email]
  }

  recipientInput.value = ''
  renderAll()
}

templateNameInput.addEventListener('input', event => {
  state.templateName = event.target.value
  renderSummary()
})

questionUrlInput.addEventListener('input', event => {
  state.questionUrl = event.target.value.trim()
  renderSummary()
})

filePatternInput.addEventListener('input', event => {
  state.filePattern = event.target.value
  renderSummary()
})

startDateInput.addEventListener('input', event => {
  state.startDate = event.target.value
  renderAll()
})

frequencyControl.addEventListener('click', event => {
  const button = event.target.closest('[data-frequency]')
  if (!button) {
    return
  }
  state.frequency = button.dataset.frequency
  renderAll()
})

weekdayListNode.addEventListener('click', event => {
  const button = event.target.closest('[data-weekday]')
  if (!button || !state.scheduleEnabled || state.frequency !== 'weekly') {
    return
  }

  const weekday = Number(button.dataset.weekday)
  if (state.selectedWeekdays.includes(weekday)) {
    state.selectedWeekdays = state.selectedWeekdays.filter(day => day !== weekday)
  } else {
    state.selectedWeekdays = [...state.selectedWeekdays, weekday].sort()
  }

  renderAll()
})

runTimeInput.addEventListener('input', event => {
  state.runTime = event.target.value
  renderAll()
})

timezoneInput.addEventListener('input', event => {
  state.timezone = event.target.value
  renderAll()
})

emailSubjectInput.addEventListener('input', event => {
  state.emailSubject = event.target.value
  renderSummary()
})

emailBodyInput.addEventListener('input', event => {
  state.emailBody = event.target.value
})

monthlyDayInput.addEventListener('input', event => {
  state.monthlyDay = event.target.value
  renderAll()
})

scheduleEnabledInput.addEventListener('change', event => {
  state.scheduleEnabled = event.target.checked
  renderAll()
})

document.getElementById('add-recipient').addEventListener('click', addRecipient)

recipientInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault()
    addRecipient()
  }
})

recipientListNode.addEventListener('click', event => {
  const button = event.target.closest('[data-recipient-index]')
  if (!button) {
    return
  }

  const index = Number(button.dataset.recipientIndex)
  state.recipients = state.recipients.filter((_, recipientIndex) => recipientIndex !== index)
  renderAll()
})

document.getElementById('save-template').addEventListener('click', () => {
  showToast('Template saved locally in this prototype.')
})

renderAll()
