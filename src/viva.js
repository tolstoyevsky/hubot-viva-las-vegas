// Description:
//   A Hubot script which helps users to create leave requests.
//
// Configuration:
//   LEAVE_COORDINATION_CHANNEL - ...
//   MAXIMUM_LENGTH_OF_LEAVE - The maximum number of days an employee is allowed to be on leave
//   MAXIMUM_LENGTH_OF_WAIT - The maximum number of days each request may take
//
// Commands:
//   hubot хочу в отпуск - initiates a new leave request
//   hubot одобрить заявку @username - approves the leave request for the specifies user
//   hubot отклонить заявку @username - rejects the leave request for the specifies user
//

module.exports = function (robot) {
  const moment = require('moment')
  const schedule = require('node-schedule')

  const LEAVE_COORDINATION_CHANNEL = process.env.LEAVE_COORDINATION_CHANNEL || 'leave-coordination'
  const MAXIMUM_LENGTH_OF_LEAVE = parseInt(process.env.MAXIMUM_LENGTH_OF_LEAVE, 10) || 28
  const MAXIMUM_LENGTH_OF_WAIT = parseInt(process.env.MAXIMUM_LENGTH_OF_WAIT, 10) || 7
  const REMINDER_SCHEDULER = process.env.REMINDER_SCHEDULER || '0 0 7 * * *'

  const INIT_STATE = 0
  const FROM_STATE = 1
  const TO_STATE = 2
  const CONFIRM_STATE = 3

  const APPROVED_STATUS = 'approved'
  const PENDING_STATUS = 'pending'
  const READY_TO_APPLY_STATUS = 'ready-to-apply'

  const ANGRY_MESSAGE = 'Давай по порядку!'

  const regExpMonthYear = new RegExp(/((0?[1-9]|[12][0-9]|3[01])\.(0?[1-9]|1[0-2]))$/)

  // Here is the format string which is suitable for the following cases: DD.MM, D.M
  // See https://momentjs.com/docs/#/parsing/string-format/ for details.
  const DATE_FORMAT = 'D.M'
  const USER_FRIENDLY_DATE_FORMAT = 'дд.мм'
  const CREATION_DATE_FORMAT = 'DD.MM.YYYY'

  const statesMessages = Object.freeze([
    '',
    `C какого числа ты бы хотел уйти в отпуск? (${USER_FRIENDLY_DATE_FORMAT})`,
    `До какого числа ты планируешь быть в отпуске? (${USER_FRIENDLY_DATE_FORMAT})`,
    'Отправить текущую заявку в HR-отдел? (да/нет)'
  ])

  function checkIfUserExists (robot, username) {
    const users = robot.brain.data.users
    const usernames = Object.values(users).map(user => user.name)

    return usernames.indexOf(username) > -1
  }

  function getStateFromBrain (robot, username) {
    const users = robot.brain.usersForFuzzyName(username)

    users[0].vivaLasVegas = users[0].vivaLasVegas || {}

    return users[0].vivaLasVegas
  }

  /**
   * Checks if the specified date
   * 1. follows the format stored in the DATE_FORMAT constant
   * 2. is a valid date.
   *
   * @param {string} date
   * @returns {boolean}
   */
  function isValidDate (date) {
    return typeof date === 'string' && moment(date, DATE_FORMAT, true).isValid()
  }

  function noname (daysNumber) {
    const lastDigit = parseInt(daysNumber.toString().split('').pop(), 10)
    switch (lastDigit) {
      case 1:
        return `${daysNumber} день`
      case 2:
      case 3:
      case 4:
        return `${daysNumber} дня`
      default:
        return `${daysNumber} дней`
    }
  }

  function sendRemindersToChannel (robot) {
    const users = robot.brain.data.users

    for (const user of Object.values(users)) {
      const state = getStateFromBrain(robot, user.name)

      if (state.requestStatus === PENDING_STATUS) {
        const deadline = moment(state.creationDate, CREATION_DATE_FORMAT).add(MAXIMUM_LENGTH_OF_WAIT, 'days').format('DD.MM')

        robot.messageRoom(LEAVE_COORDINATION_CHANNEL, `Нужно дать ответ @${user.name} до ${deadline}.`)
      }
    }
  }

  robot.respond(/хочу в отпуск$/i, function (msg) {
    const state = getStateFromBrain(robot, msg.message.user.name)

    if (state.n !== undefined && state.n !== INIT_STATE) {
      msg.send(`${ANGRY_MESSAGE}\n${statesMessages[state.n]}`)

      return
    }

    if (state.requestStatus === APPROVED_STATUS) {
      msg.send('Твоя предыдущая заявка была одобрена, так что сначала отгуляй этот отпуск.')

      return
    }

    if (state.requestStatus === PENDING_STATUS) {
      msg.send('Ты уже отправил заявку на отпуск. Дождись ответа.')

      return
    }

    state.creationDate = moment().format(CREATION_DATE_FORMAT)
    state.n = FROM_STATE

    msg.send(`Ok, с какого числа? (${USER_FRIENDLY_DATE_FORMAT})`)
  })

  robot.respond(regExpMonthYear, function (msg) {
    const date = msg.match[1]
    const day = msg.match[2]
    const month = msg.match[3]
    const state = getStateFromBrain(robot, msg.message.user.name)

    if (!isValidDate(date)) {
      msg.send(`Указанная дата является невалидной. Попробуй еще раз.`)

      return
    }

    if (state.n === FROM_STATE) {
      const leaveStart = {}

      leaveStart.day = day
      leaveStart.month = month
      leaveStart.year = moment().year()

      state.leaveStart = leaveStart
      state.n = TO_STATE

      msg.send(`Отлично, по какое? (${USER_FRIENDLY_DATE_FORMAT})`)

      return
    }

    if (state.n === TO_STATE) {
      const leaveStart = state.leaveStart
      const leaveEnd = {}
      const year = leaveStart.day >= day && leaveStart.month >= month ? moment().year() + 1 : moment().year()
      const d1 = moment(`${leaveStart.day}.${leaveStart.month}.${leaveStart.year}`, 'D.M.YYYY')
      const d2 = moment(`${day}.${month}.${year}`, 'D.M.YYYY')
      const daysNumber = d2.diff(d1, 'days')

      if (daysNumber > MAXIMUM_LENGTH_OF_LEAVE) {
        msg.send(`Отпуск продолжительностью ${noname(daysNumber)} выглядит круто (особенно если он оплачиваемый :joy:), но ты можешь претендовать максимум на ${noname(MAXIMUM_LENGTH_OF_LEAVE)}.`)

        return
      }

      leaveEnd.day = day
      leaveEnd.month = month
      leaveEnd.year = year

      state.leaveEnd = leaveEnd
      state.n = CONFIRM_STATE

      msg.send(`Значит ты планируешь находиться в отпуске ${noname(daysNumber)}. Все верно? (да/нет)`)
    }
  })

  robot.respond(/(да|нет)$/i, function (msg) {
    const username = msg.message.user.name
    const state = getStateFromBrain(robot, username)

    if (state.n === CONFIRM_STATE) {
      const answer = msg.match[1]

      if (answer === 'да') {
        const deadline = moment(state.creationDate, CREATION_DATE_FORMAT).add(MAXIMUM_LENGTH_OF_WAIT, 'days').format('DD.MM')
        const from = moment(`${state.leaveStart.day}.${state.leaveStart.month}`, 'D.M').format('DD.MM')
        const to = moment(`${state.leaveEnd.day}.${state.leaveEnd.month}`, 'D.M').format('DD.MM')

        robot.messageRoom(LEAVE_COORDINATION_CHANNEL, `@${username} хочет в отпуск с ${from} по ${to}. Ответ нужно дать до ${deadline}.`)

        state.requestStatus = PENDING_STATUS

        msg.send(`Заявка на отпуск отправлена. Ответ поступит не позже чем через ${noname(MAXIMUM_LENGTH_OF_WAIT)}.`)
      } else {
        msg.send('Я прервал процесс формирования заявки на отпуск.')
      }

      state.n = INIT_STATE
    }
  })

  robot.respond(/(одобрить|отклонить) заявку @?(.+)$/i, function (msg) {
    const action = msg.match[1]
    const username = msg.match[2].trim()

    if (checkIfUserExists(robot, username)) {
      const state = getStateFromBrain(robot, username)
      let requestStatus
      let result

      if (state.requestStatus !== PENDING_STATUS) {
        msg.send('У этого пользователя нет ожидающей ответа заявки.')

        return
      }

      if (action === 'одобрить') {
        result = 'одобрена'
        requestStatus = APPROVED_STATUS
      } else {
        result = 'отклонена'
        requestStatus = READY_TO_APPLY_STATUS
      }

      state.requestStatus = requestStatus

      msg.send(`Заявка @${username} ${result}. Я отправлю ему уведомление об этом.`)

      robot.adapter.sendDirect({ user: { name: username } }, `Заявка на отпуск ${result}.`)
    } else {
      msg.send('Пользователя с таким именем нет или я его просто не знаю, т.к. он ни разу не говорил со мной.')
    }
  })

  if (REMINDER_SCHEDULER) {
    schedule.scheduleJob(REMINDER_SCHEDULER, () => sendRemindersToChannel(robot))
  }
}
