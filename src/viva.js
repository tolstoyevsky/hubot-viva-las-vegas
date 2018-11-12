// Description:
//   A Hubot script which helps users to create leave requests.
//
// Configuration:
//   LEAVE_COORDINATION_CHANNEL - The channel name to handle users leave requests
//   MAXIMUM_LENGTH_OF_LEAVE - The maximum number of days an employee is allowed to be on leave
//   MAXIMUM_LENGTH_OF_WAIT - The maximum number of days each request may take
//
// Commands:
//   hubot хочу в отпуск - initiates a new leave request
//   hubot одобрить заявку @username - approves the leave request for the specified user (privileged: admins only)
//   hubot отклонить заявку @username - rejects the leave request for the specified user (privileged: admins only)
//   hubot отменить заявку @username - cancels the approved leave request for the specified user (privileged: admins only)
//   hubot список заявок - prints the list of leave requests both awaiting approval and already approved (privileged: admins only)
//

module.exports = async (robot) => {
  const moment = require('moment')
  const routines = require('hubot-routines')
  const schedule = require('node-schedule')

  const LEAVE_COORDINATION_CHANNEL = process.env.LEAVE_COORDINATION_CHANNEL || 'leave-coordination'
  const MAXIMUM_LENGTH_OF_LEAVE = parseInt(process.env.MAXIMUM_LENGTH_OF_LEAVE, 10) || 28
  const MAXIMUM_LENGTH_OF_WAIT = parseInt(process.env.MAXIMUM_LENGTH_OF_WAIT, 10) || 7
  const MINIMUM_DAYS_BEFORE_REQUEST = parseInt(process.env.MINIMUM_DAYS_BEFORE_REQUEST, 10) || 7
  const VIVA_REMINDER_SCHEDULER = process.env.VIVA_REMINDER_SCHEDULER || '0 0 7 * * *'

  const INIT_STATE = 0
  const FROM_STATE = 1
  const TO_STATE = 2
  const CONFIRM_STATE = 3

  const APPROVED_STATUS = 'approved'
  const PENDING_STATUS = 'pending'
  const READY_TO_APPLY_STATUS = 'ready-to-apply'

  const ANGRY_MSG = 'Давай по порядку!'
  const ACCESS_DENIED_MSG = 'У тебя недостаточно прав для этой команды :rolling_eyes:'
  const DONE_MSG = 'Готово!'
  const INVALID_DATE_MSG = 'Указанная дата является невалидной. Попробуй еще раз.'

  const regExpMonthYear = new RegExp(/((\d{1,2})\.(\d{1,2}))\s*$/)

  // Checking if the bot is in the channel specified via the LEAVE_COORDINATION_CHANNEL environment variable.
  const botChannels = await robot.adapter.api.get('channels.list.joined')
  const botGroups = await robot.adapter.api.get('groups.list')
  const chExists = botChannels.channels.filter(item => item.name === LEAVE_COORDINATION_CHANNEL).length
  const grExists = botGroups.groups.filter(item => item.name === LEAVE_COORDINATION_CHANNEL).length
  if (!chExists && !grExists) {
    routines.rave(robot, `Hubot is not in the group or channel named '${LEAVE_COORDINATION_CHANNEL}'`)
    return
  }

  // Here is the format string which is suitable for the following cases: DD.MM, D.M
  // See https://momentjs.com/docs/#/parsing/string-format/ for details.
  const DATE_FORMAT = 'D.M'
  const USER_FRIENDLY_DATE_FORMAT = 'дд.мм'
  const CREATION_DATE_FORMAT = 'DD.MM.YYYY'

  const statesMessages = Object.freeze([
    '',
    `C какого числа ты хочешь уйти в отпуск? (${USER_FRIENDLY_DATE_FORMAT})`,
    `До какого числа ты планируешь быть в отпуске? (${USER_FRIENDLY_DATE_FORMAT})`,
    'Отправить текущую заявку в HR-отдел? (да/нет)'
  ])

  /**
   * Check if user has warned the customer.
   *
   * @param {Boolean} status - If user has warned the customer or not.
   * @returns {String}
   */
  function isReport (status) {
    return status ? 'в курсе. :white_check_mark:' : 'не предупрежден. :x:'
  }

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
   * Check if two specified dates have the same month and day.
   *
   * @param {moment} firstDate
   * @param {moment} secondsDate
   * @returns {boolean}
   */
  function isEqualMonthDay (firstDate, secondsDate) {
    return (firstDate.month() === secondsDate.month()) && (firstDate.date() === secondsDate.date())
  }

  function noname (daysNumber) {
    const lastTwoDigits = daysNumber.toString().slice(daysNumber.length - 2)
    const exceptionDaysEnd = ['11', '12', '13', '14']
    if (exceptionDaysEnd.includes(lastTwoDigits)) {
      return `${daysNumber} дней`
    }

    const lastDigit = parseInt(daysNumber.toString().split('').pop(), 10)
    switch (lastDigit) {
      case 0:
        return `${daysNumber} дней`
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

  /**
   * Reset the leave status of the users if their vacation is over.
   *
   * @param {Robot} robot - Hubot instance.
   * @returns {Void}
   */
  function resetLeaveStatus (robot) {
    const users = robot.brain.data.users

    for (const user of Object.values(users)) {
      const state = getStateFromBrain(robot, user.name)

      if (state.requestStatus === APPROVED_STATUS) {
        const yesterday = moment().add(-1, 'day')
        const userEndVacation = moment(`${state.leaveEnd.day}.${state.leaveEnd.month}`, 'D.M')

        if (isEqualMonthDay(yesterday, userEndVacation)) {
          state.n = INIT_STATE
          delete state.leaveStart
          delete state.leaveEnd
          delete state.requestStatus

          robot.adapter.sendDirect({ user: { name: user.name } }, 'С возвращением из отпуска!')
        }
      }
    }
  }

  /**
   * Send reminder one day before vacation if the user have not warned the customer.
   *
   * @param {Robot} robot - Hubot instance.
   */
  function checkIfNotReported (robot) {
    const users = Object.values(robot.brain.data.users)
    const tomorrow = moment().add(1, 'day')

    for (const user of users) {
      const vivaLasVegas = user.vivaLasVegas
      if (!vivaLasVegas || vivaLasVegas.requestStatus !== APPROVED_STATUS) {
        continue
      }
      const leaveStart = moment(user.leaveStart)

      if (isEqualMonthDay(leaveStart, tomorrow)) {
        const message = `${user.name} завтра уходит в отпуск. Заказчик ${isReport(vivaLasVegas.reportToCustomer)}.`

        robot.messageRoom(LEAVE_COORDINATION_CHANNEL, message)
      }
    }
  }

  /**
   * Send reminders of the upcoming vacation to HR channel.
   *
   * @param {Robot} robot - Hubot instance.
   * @param {Number} amount - Amount of days before requested vacation's start.
   */
  function checkLeaveTimeLeft (robot, amount) {
    const users = Object.values(robot.brain.data.users)
    const currentDay = moment().add(amount, 'days')

    let message = []

    for (const user of users) {
      const obj = user.vivaLasVegas.leaveStart
      if (!obj) {
        continue
      }
      const leaveStart = moment(`${obj.day}.${obj.month}.${obj.year}`, 'D.M.YYYY')
      if (user.vivaLasVegas.requestStatus === APPROVED_STATUS && isEqualMonthDay(currentDay, leaveStart)) {
        message.push(` @${user.name} уходит в отпуск через ${noname(amount)}. Заказчик ${isReport(user.vivaLasVegas.reportToCustomer)}`)

        if (!user.vivaLasVegas.reportToCustomer) {
          const question = `Привет, твой отпуск начинается уже через ${noname(amount)}. Заказчик предупрежден? (да/нет)`
          robot.adapter.sendDirect({ user: { name: user.name } }, question)
        }
      }
    }

    if (message.length) {
      robot.messageRoom(LEAVE_COORDINATION_CHANNEL, message.join('\n'))
    }
  }

  robot.respond(/хочу в отпуск\s*/i, function (msg) {
    const state = getStateFromBrain(robot, msg.message.user.name)

    if (state.n !== undefined && state.n !== INIT_STATE) {
      const leaveStart = state.leaveStart
      const leaveEnd = state.leaveEnd
      let infoMessage

      switch (state.n) {
        case 1: {
          infoMessage = '\n'
          break
        }
        case 2: {
          infoMessage = `\nИтак, ты хочешь в отпуск с ${moment(`${leaveStart.day}.${leaveStart.month}`, DATE_FORMAT).format('DD.MM')}.\n`
          break
        }
        case 3: {
          infoMessage = `\nИтак, ты хочешь уйти в отпуск с ${moment(`${leaveStart.day}.${leaveStart.month}`, DATE_FORMAT).format('DD.MM')} по ${moment(`${leaveEnd.day}.${leaveEnd.month}`, DATE_FORMAT).format('DD.MM')}.\n`
          break
        }
      }

      msg.send(`${ANGRY_MSG}${infoMessage}${statesMessages[state.n]}`)

      return
    }

    if (state.requestStatus === APPROVED_STATUS) {
      msg.send('Твоя предыдущая заявка была одобрена, так что сначала отгуляй этот отпуск.')

      return
    }

    if (state.requestStatus === PENDING_STATUS) {
      msg.send('Твоя заявка на отпуск уже отправлена. Дождись ответа.')

      return
    }

    state.creationDate = moment().format(CREATION_DATE_FORMAT)
    state.n = FROM_STATE

    msg.send(`Ok, с какого числа? (${USER_FRIENDLY_DATE_FORMAT})`)
  })

  robot.respond(regExpMonthYear, function (msg) {
    const date = msg.match[1]
    const state = getStateFromBrain(robot, msg.message.user.name)

    let day = parseInt(msg.match[2])
    let month = parseInt(msg.match[3])

    if ([FROM_STATE, TO_STATE].includes(state.n) && !routines.isValidDate(date, DATE_FORMAT)) {
      msg.send(INVALID_DATE_MSG)

      return
    }

    if (state.n === FROM_STATE) {
      const today = moment()
      // moment().month() starts counting with 0
      const currentMonth = today.month() + 1
      let year

      if (currentMonth === month) {
        if (today.date() >= day) {
          year = today.year() + 1
        } else {
          year = today.year()
        }
      } else if (currentMonth > month) {
        year = today.year() + 1
      } else {
        year = today.year()
      }

      const startDay = moment(`${day}.${month}.${year}`, 'D.M.YYYY')
      const daysBefore = startDay.diff(today, 'days')

      if (daysBefore < MINIMUM_DAYS_BEFORE_REQUEST) {
        const minDate = today.add(MINIMUM_DAYS_BEFORE_REQUEST, 'd').format('DD.MM.YYYY')
        msg.send(`Нужно запрашивать отпуск минимум за ${noname(MINIMUM_DAYS_BEFORE_REQUEST)}, а до твоего - только ${noname(daysBefore)}. Попробуй выбрать дату позднее ${minDate}.`)
        return
      }

      const leaveStart = {}

      leaveStart.day = day
      leaveStart.month = month
      leaveStart.year = year

      state.leaveStart = leaveStart
      state.n = TO_STATE

      msg.send(`Отлично, по какое? (${USER_FRIENDLY_DATE_FORMAT})`)

      return
    }

    if (state.n === TO_STATE) {
      const leaveStart = state.leaveStart
      const leaveEnd = {}

      let year = leaveStart.month >= month && leaveStart.day >= day ? leaveStart.year + 1 : leaveStart.year

      const d1 = moment(`${leaveStart.day}.${leaveStart.month}.${leaveStart.year}`, 'D.M.YYYY')
      const d2 = moment(`${day}.${month}.${year}`, 'D.M.YYYY')

      let withWeekends = ''

      if (d2.day() >= 5) {
        d2.day(7)

        day = d2.date()
        month = d2.month()
        year = d2.year()

        withWeekends = ' (учитывая выходные)'
      }

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

      msg.send(`Значит ты планируешь находиться в отпуске ${noname(daysNumber)}${withWeekends}. Все верно? (да/нет)`)
    }
  })

  robot.respond(/(да|нет)\s*/i, function (msg) {
    const username = msg.message.user.name
    const state = getStateFromBrain(robot, username)
    const answer = msg.match[1].toLowerCase()

    if (state.n === CONFIRM_STATE) {
      if (answer === 'да') {
        const deadline = moment(state.creationDate, CREATION_DATE_FORMAT).add(MAXIMUM_LENGTH_OF_WAIT, 'days').format('DD.MM')
        const from = moment(`${state.leaveStart.day}.${state.leaveStart.month}`, 'D.M').format('DD.MM')
        const to = moment(`${state.leaveEnd.day}.${state.leaveEnd.month}`, 'D.M').format('DD.MM')

        robot.messageRoom(LEAVE_COORDINATION_CHANNEL, `Пользователь @${username} хочет в отпуск с ${from} по ${to}. Ответ нужно дать до ${deadline}.`)

        state.requestStatus = PENDING_STATUS
        state.reportToCustomer = false

        msg.send(`Заявка на отпуск отправлена. Ответ поступит не позже чем через ${noname(MAXIMUM_LENGTH_OF_WAIT)}.`)
      } else {
        msg.send('Я прервал процесс формирования заявки на отпуск.')
      }

      state.n = INIT_STATE
    } else if (!state.reportToCustomer) {
      if (answer === 'да') {
        state.reportToCustomer = true
        robot.messageRoom(LEAVE_COORDINATION_CHANNEL, `Пользователь @${username} только что сообщил, что предупредил заказчика о своем отпуске.`)
        msg.send(':thumbsup:')
      } else {
        msg.send('Обязательно предупреди! :fearful:')
      }
    }
  })

  robot.respond(/(отменить заявку @?(.+))\s*/i, async (msg) => {
    if (!await routines.isAdmin(robot, msg.message.user.name)) {
      msg.send(ACCESS_DENIED_MSG)
      return
    }

    const username = msg.match[2].trim()
    const state = getStateFromBrain(robot, username)

    const isRequestStatus = state.requestStatus && state.requestStatus !== READY_TO_APPLY_STATUS

    if (state.requestStatus === APPROVED_STATUS) {
      state.n = INIT_STATE
      delete state.leaveStart
      delete state.leaveEnd
      delete state.requestStatus

      if (msg.message.room !== LEAVE_COORDINATION_CHANNEL) {
        robot.messageRoom(LEAVE_COORDINATION_CHANNEL, `Пользователь @${msg.message.user.name} отменил заявку на отпуск пользователя @${username}.`)
      }

      robot.adapter.sendDirect({ user: { name: username } }, `Упс, пользователь @${msg.message.user.name} только что отменил твою заявку на отпуск.`)
      msg.send(`Отпуск пользователя @${username} отменен.`)
    } else if (isRequestStatus) {
      msg.send('Отменить можно только одобренные заявки. Используй команду \'отклонить\'.')
    } else {
      msg.send('Этот человек не собирается в отпуск.')
    }
  })
  robot.respond(/(одобрить|отклонить) заявку @?(.+)\s*/i, async (msg) => {
    const action = msg.match[1]
    const username = msg.match[2].trim()

    if (!await routines.isAdmin(robot, msg.message.user.name)) {
      msg.send(ACCESS_DENIED_MSG)
      return
    }

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

      if (msg.message.room !== LEAVE_COORDINATION_CHANNEL) {
        const admin = msg.message.user.name
        robot.messageRoom(LEAVE_COORDINATION_CHANNEL, `Заявка на отпуск пользователя @${username} была ${result} пользователем @${admin}.`)
      }

      msg.send(`Заявка @${username} ${result}. Я отправлю этому пользователю уведомление об этом.`)

      robot.adapter.sendDirect({ user: { name: username } }, `Заявка на отпуск ${result}.`)
    } else {
      msg.send('Пользователя с таким именем нет или я его просто не знаю, т.к. он ни разу не говорил со мной.')
    }
  })

  /**
   * Overwrites vacation ending date.
   *
   * @example viva reset @username DD.MM.
   */
  robot.respond(/(viva reset @?(.+) (\d{1,2}\.\d{1,2}))\s*/i, async (msg) => {
    if (!await routines.isAdmin(robot, msg.message.user.name)) {
      msg.send(ACCESS_DENIED_MSG)
      return
    }

    const username = msg.match[2]
    const dateMonth = msg.match[3]

    if (!routines.isValidDate(dateMonth, DATE_FORMAT)) {
      msg.send(INVALID_DATE_MSG)

      return
    }

    const user = robot.brain.userForName(username)

    user.vivaLasVegas.leaveEnd = {
      day: dateMonth.split('.')[0],
      month: dateMonth.split('.')[1],
      year: moment().year()
    }

    msg.send(DONE_MSG)
  })

  robot.respond(/список заявок\s*/i, async msg => {
    if (!await routines.isAdmin(robot, msg.message.user.name)) {
      msg.send(ACCESS_DENIED_MSG)
      return
    }

    const users = Object.values(robot.brain.data.users)

    const formatLine = user => {
      const username = user.name
      const from = user.vivaLasVegas.leaveStart
      const to = user.vivaLasVegas.leaveEnd

      const formattedDate =
        moment(`${from.day}.${from.month}.${from.year}`, 'D.M.YYYY').format('DD.MM.YYYY') +
        ' - ' +
        moment(`${to.day}.${to.month}.${to.year}`, 'D.M.YYYY').format('DD.MM.YYYY')

      return ` @${username} ${formattedDate}`
    }

    const sorting = (a, b, format) => {
      const first = moment(a, format)
      const second = moment(b, format)

      return first.unix() - second.unix()
    }

    const approved = users
      .filter(user => user.vivaLasVegas && user.vivaLasVegas.requestStatus === APPROVED_STATUS)
      .sort((a, b) => sorting(a.vivaLasVegas.leaveStart, b.vivaLasVegas.leaveStart, ''))
      .map(formatLine)
      .join('\n')
    const pending = users
      .filter(user => user.vivaLasVegas && user.vivaLasVegas.requestStatus === PENDING_STATUS)
      .sort((a, b) => sorting(a.vivaLasVegas.leaveStart, b.vivaLasVegas.leaveStart, ''))
      .map(formatLine)
      .join('\n')

    const result = []

    if (approved) result.push(`*Одобренные заявки:*\n ${approved}`)
    if (pending) result.push(`*Ожидающие подтверждения:*\n ${pending}`)
    if (!result.length) result.push('Никто не собирается в отпуск.')

    msg.send(result.join('\n'))
  })

  if (VIVA_REMINDER_SCHEDULER) {
    schedule.scheduleJob(VIVA_REMINDER_SCHEDULER, () => sendRemindersToChannel(robot))

    schedule.scheduleJob(VIVA_REMINDER_SCHEDULER, () => resetLeaveStatus(robot))

    schedule.scheduleJob(VIVA_REMINDER_SCHEDULER, () => checkLeaveTimeLeft(robot, 30))
    schedule.scheduleJob(VIVA_REMINDER_SCHEDULER, () => checkLeaveTimeLeft(robot, 14))
    schedule.scheduleJob(VIVA_REMINDER_SCHEDULER, () => checkIfNotReported(robot))
  }
}
