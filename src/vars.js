const GOOGLE_API = process.env.GOOGLE_API === 'true' || false
const GOOGLE_EVENT_SICK = 'Болеет'
const GOOGLE_EVENT_SICK_WITH_WORK = 'Болеет (работа из дома)'
const GOOGLE_EVENT_VACATION = 'Отпуск'
const GOOGLE_EVENT_WORK_FROM_HOME = 'Работа из дома'
const GOOGLE_CALENDAR_NAME = process.env.GOOGLE_CALENDAR_NAME || 'WIS Calendar'
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.split('\\n').join('\n') : null
const LEAVE_COORDINATION_CHANNEL = process.env.LEAVE_COORDINATION_CHANNEL || 'leave-coordination'
const MAXIMUM_LENGTH_OF_LEAVE = parseInt(process.env.MAXIMUM_LENGTH_OF_LEAVE, 10) || 28
const MAXIMUM_LENGTH_OF_WAIT = parseInt(process.env.MAXIMUM_LENGTH_OF_WAIT, 10) || 7
const MINIMUM_DAYS_BEFORE_REQUEST = parseInt(process.env.MINIMUM_DAYS_BEFORE_REQUEST, 10) || 7
const VIVA_REMINDER_SCHEDULER = process.env.VIVA_REMINDER_SCHEDULER || '0 0 7 * * *'
const VIVA_REPORT_SCHEDULER = process.env.VIVA_REPORT_SCHEDULER || '0 0 11 * * *'

const INIT_STATE = 0
const FROM_STATE = 1
const TO_STATE = 2
const CONFIRM_STATE = 3
const WAITING_DATE_STATE = 4
const WAITING_CONFIRMATION_STATE = 5

const APPROVED_STATUS = 'approved'
const PENDING_STATUS = 'pending'

const ANGRY_MSG = 'Давай по порядку!'
const ACCESS_DENIED_MSG = 'У тебя недостаточно прав для этой команды :rolling_eyes:'
const CONFUSED_MSG = 'Я не понимаю, о чем ты. :shrug:'
const INVALID_DATE_MSG = 'Указанная дата является невалидной. Попробуй еще раз.'
const UNKNOWN_USER_MSG = 'Пользователя с таким именем нет или я его просто не знаю, т.к. он ни разу не говорил со мной.'

const regExpMonthYear = new RegExp(/(сегодня|завтра|((\d{1,2})\.(\d{1,2})))\s*$/, 'i')

// Here is the format string which is suitable for the following cases: DD.MM, D.M
// See https://momentjs.com/docs/#/parsing/string-format/ for details.
const DATE_FORMAT = 'D.M'
const OUTPUT_DATE_FORMAT = 'DD.MM'
const USER_FRIENDLY_DATE_FORMAT = 'дд.мм'
const CREATION_DATE_FORMAT = 'DD.MM.YYYY'

const statesMessages = Object.freeze([
  '',
  `C какого числа %s уйти в отпуск? (${USER_FRIENDLY_DATE_FORMAT})`,
  `До какого числа %s быть в отпуске? (${USER_FRIENDLY_DATE_FORMAT})`,
  'Отправить текущую заявку в HR-отдел?'
])

module.exports = {
  GOOGLE_API,
  GOOGLE_EVENT_SICK,
  GOOGLE_EVENT_SICK_WITH_WORK,
  GOOGLE_EVENT_VACATION,
  GOOGLE_EVENT_WORK_FROM_HOME,
  GOOGLE_CALENDAR_NAME,
  GOOGLE_CLIENT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  LEAVE_COORDINATION_CHANNEL,
  MAXIMUM_LENGTH_OF_LEAVE,
  MAXIMUM_LENGTH_OF_WAIT,
  MINIMUM_DAYS_BEFORE_REQUEST,
  VIVA_REMINDER_SCHEDULER,
  VIVA_REPORT_SCHEDULER,
  INIT_STATE,
  FROM_STATE,
  TO_STATE,
  CONFIRM_STATE,
  WAITING_DATE_STATE,
  WAITING_CONFIRMATION_STATE,
  APPROVED_STATUS,
  PENDING_STATUS,
  ANGRY_MSG,
  ACCESS_DENIED_MSG,
  CONFUSED_MSG,
  INVALID_DATE_MSG,
  UNKNOWN_USER_MSG,
  regExpMonthYear,
  DATE_FORMAT,
  OUTPUT_DATE_FORMAT,
  USER_FRIENDLY_DATE_FORMAT,
  CREATION_DATE_FORMAT,
  statesMessages
}
