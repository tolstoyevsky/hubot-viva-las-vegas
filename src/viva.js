// Description:
//   A Hubot script which helps users to create leave requests.
//
// Commands:
//  begin group Viva Las Vegas
//    hubot работаю из дома - sets the status of work from home and adds the corresponding event to the calendar
//    hubot не работаю из дома - removes work from home status and deletes the corresponding event from the calendar
//    hubot хочу в отпуск - initiates a new leave request
//    hubot болею - sets the status of being ill and adds the corresponding event to the calendar
//    hubot не болею - removes status of being ill and stops the prolongation of the corresponding event in the calendar
//    begin admin
//      hubot @username хочет в отпуск - initiates a new leave request on behalf of the specified user
//      hubot одобрить заявку @username - approves the leave request for the specified user
//      hubot отклонить заявку @username - rejects the leave request for the specified user
//      hubot отменить заявку @username - cancels the approved leave request for the specified user
//      hubot список заявок - prints the list of leave requests both awaiting approval and already approved
//    end admin
//  end group
//

module.exports = async (robot) => {
  const { google } = require('googleapis')
  const moment = require('moment')
  const routines = require('hubot-routines')
  const schedule = require('node-schedule')

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

  if (!(await routines.isBotInRoom(robot, LEAVE_COORDINATION_CHANNEL))) {
    routines.rave(robot, `Hubot is not in the group or channel named '${LEAVE_COORDINATION_CHANNEL}'`)
    return
  }

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

  const { Stack } = require('./stack')

  let users = Object.values(robot.brain.data.users)

  users.forEach(user => {
    if (user.vivaLasVegas && user.vivaLasVegas.dateOfWorkFromHome && typeof user.vivaLasVegas.dateOfWorkFromHome === 'string') {
      user.vivaLasVegas.dateOfWorkFromHome = [(user.vivaLasVegas.dateOfWorkFromHome), user.vivaLasVegas.dateOfWorkFromHome]
      console.log('*')
    }
  })

  /**
   * Check if user has warned the customer.
   *
   * @param {Boolean} status - If user has warned the customer or not.
   * @returns {Array}
   */
  function isReport (status) {
    return status ? [':white_check_mark:', 'в курсе.'] : [':x:', 'не предупрежден.']
  }

  let GOOGLE_JWT_CLIENT
  let GOOGLE_CALENDAR
  let GOOGLE_CALENDAR_ID

  /**
   * Google auth.
   *
   * @param {Object} data - Google Service Account Data.
   * @returns {Boolean}
   */
  async function googleAuth (data) {
    const SCOPES = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar'
    ]

    GOOGLE_JWT_CLIENT = new google.auth.JWT(
      data.client_email,
      null,
      data.private_key,
      SCOPES,
      null
    )

    let result = true

    await new Promise((resolve, reject) => {
      GOOGLE_JWT_CLIENT.authorize((err, response) => {
        if (err) {
          reject(err)
        }
        resolve(response)
      })
    }).catch(() => {
      result = false
    })

    return result
  }

  /**
   * Get Google calendar id.
   *
   * @returns {Void | String} - Calendar id.
   */
  async function getCalendar () {
    const result = await new Promise((resolve, reject) => {
      GOOGLE_CALENDAR.calendarList.list((err, response) => {
        if (err) {
          reject(err)
        }
        resolve(response)
      })
    }).catch((err) => {
      if (err) {
        routines.rave(robot, 'Couldn\'t find the calendars list.')
      }
    })

    if (!result.data.items.length) {
      routines.rave(robot, 'There are no calendars.')
      return
    }

    const calendars = result.data.items.filter(item => item.summary === GOOGLE_CALENDAR_NAME)
    if (!calendars.length) {
      routines.rave(robot, 'Couldn\'t find the calendar with the specified name.')
      return
    }

    return calendars.shift().id
  }

  function checkIfUserExists (robot, username) {
    const users = robot.brain.data.users
    const usernames = Object.values(users).map(user => user.name)

    return usernames.indexOf(username) > -1
  }

  function cleanupState (state) {
    state.n = INIT_STATE
    delete state.leaveStart
    delete state.leaveEnd
    delete state.requestStatus
  }

  function getStateFromBrain (robot, username) {
    const users = robot.brain.usersForFuzzyName(username)

    users[0].vivaLasVegas = users[0].vivaLasVegas || {}

    return users[0].vivaLasVegas
  }

  /**
   * Check if two specified dates are the same.
   *
   * @param {moment} firstDate
   * @param {moment} secondsDate
   * @returns {boolean}
   */
  function isEqualDate (firstDate, secondsDate) {
    const a = moment(firstDate.format(CREATION_DATE_FORMAT), CREATION_DATE_FORMAT)
    const b = moment(secondsDate.format(CREATION_DATE_FORMAT), CREATION_DATE_FORMAT)
    return a.diff(b, 'days') === 0
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
        const userEndVacation = moment(`${state.leaveEnd.day}.${state.leaveEnd.month}.${state.leaveEnd.year}`, CREATION_DATE_FORMAT)

        if (isEqualDate(yesterday, userEndVacation)) {
          cleanupState(state)

          robot.adapter.sendDirect({ user: { name: user.name } }, 'С возвращением из отпуска!')
        }
      }
    }
  }

  /**
   * Add a new event to the calendar.
   *
   * @param {String} start
   * @param {String} end
   * @param {Object} user
  */
  async function addEventToCalendar (start, end, user, type) {
    // Google API date format YYYY-MM-DD
    let event = {
      summary: `${type} (${user.name})`,
      start: {
        date: `${start}`
      },
      end: {
        date: `${end}`
      }
    }

    const result = await new Promise((resolve, reject) => {
      GOOGLE_CALENDAR.events.insert({
        calendarId: GOOGLE_CALENDAR_ID,
        resource: event
      }, (err, response) => {
        if (err) {
          reject(err)
        } else {
          resolve(response)
        }
      })
    }).catch((err) => {
      routines.rave(robot, `An error occurred when attempting to add an event to the calendar.\n${err.message}`)
    })

    if (result) {
      return result.data.id
    } else {
      return false
    }
  }

  /**
   * Delete the event from the calendar by id.
   *
   * @param {string} eventId - Event id.
   */
  function deleteEventFromCalendar (eventId) {
    GOOGLE_CALENDAR.events.delete({
      calendarId: GOOGLE_CALENDAR_ID,
      eventId: eventId
    }, (err) => {
      if (err) {
        routines.rave(robot, `An error occurred when attempting to delete an event from the calendar.\n${err.message}`)
      }
    })
  }

  /**
   * Get the event from the calendar by id.
   *
   * @param {string} eventId - Event id.
   */
  function getEventFromCalendar (eventId) {
    return GOOGLE_CALENDAR.events.get({
      calendarId: GOOGLE_CALENDAR_ID,
      eventId
    }).catch((err) => {
      routines.rave(robot, `An error occurred when attempting to get an event from the calendar.\n${err.message}`)
    })
  }

  /**
   * Update the event from the calendar by id.
   *
   * @param {string} eventId - Event id.
   * @param {Object} resource - Event data.
   */
  function updateEventFromCalendar (eventId, resource) {
    return GOOGLE_CALENDAR.events.update({
      calendarId: GOOGLE_CALENDAR_ID,
      eventId,
      resource
    }).catch((err) => {
      routines.rave(robot, `An error occurred when attempting to update an event from the calendar.\n${err.message}`)
    })
  }

  (async () => {
    if (GOOGLE_API) {
      if (GOOGLE_CLIENT_EMAIL && GOOGLE_PRIVATE_KEY) {
        const AUTH_TO_GOOGLE_API = {
          private_key: GOOGLE_PRIVATE_KEY,
          client_email: GOOGLE_CLIENT_EMAIL
        }

        if (await googleAuth(AUTH_TO_GOOGLE_API)) {
          GOOGLE_CALENDAR = await google.calendar({ auth: GOOGLE_JWT_CLIENT, version: 'v3' })

          GOOGLE_CALENDAR_ID = await getCalendar()
          if (!GOOGLE_CALENDAR_ID) {
            return void 0
          }
        } else {
          routines.rave(robot, 'Couldn\'t be authenticated.')
        }
      } else {
        routines.rave(robot, 'The params related to Google Calendar API wasn\'t specified.')
      }
    }
  })()

  /**
   * Send reminders of the upcoming vacation to HR channel.
   *
   * @param {Robot} robot - Hubot instance.
   */
  async function checkLeaveTimeLeft (robot) {
    const users = Object.values(robot.brain.data.users)
    const sortedUsers = users
      .filter(users => users.vivaLasVegas && users.vivaLasVegas.leaveStart && users.vivaLasVegas.requestStatus === APPROVED_STATUS)
      .sort((a, b) => sortingByValue(a.vivaLasVegas, b.vivaLasVegas, 'DD.MM.YYYY'))
      .sort((a, b) => sortingByStatus(a.vivaLasVegas, b.vivaLasVegas))

    let message = []

    for (const user of sortedUsers) {
      if (await routines.isUserActive(robot, user)) {
        const obj = user.vivaLasVegas.leaveStart
        const reportStatus = user.vivaLasVegas.reportToCustomer
        const leaveStart = moment(`${obj.day}.${obj.month}.${obj.year}`, 'D.M.YYYY')
        const amount = leaveStart.diff(moment(), 'days') + 1
        const days = Object.values(arguments).slice(1)
        const currentDay = days.indexOf(parseInt(amount)) >= 0

        if (currentDay) {
          if ((amount === 1 && !reportStatus) || amount !== 1) {
            const emoji = isReport(reportStatus)[0]
            const status = isReport(reportStatus)[1]
            message.push(`${emoji} @${user.name} уходит в отпуск через ${noname(amount)}. Заказчик ${status}`)
          }

          if (!reportStatus) {
            const question = routines.buildMessageWithButtons(
              `Привет, твой отпуск начинается уже через ${noname(amount)}. Заказчик предупрежден?`,
              [
                ['Да', 'Да, предупрежден'],
                ['Нет', 'Нет, не предупрежден']
              ]
            )
            robot.adapter.sendDirect({ user: { name: user.name } }, question)
          }
        }
      }
    }

    if (message.length) {
      robot.messageRoom(LEAVE_COORDINATION_CHANNEL, message.join('\n'))
    }
  }

  /**
   * Transform such adverbs as 'завтра' and 'сегодня' into a specific date according
   * to the specified date format.
   *
   * @param {string} adverb - Adverb to be transformed.
   * @param {string} format - Date format.
   *
   * @returns {boolean | string}
   */
  function adverbToDate (adverb, format) {
    if (adverb === 'сегодня') {
      return moment().format(format)
    }

    if (adverb === 'завтра') {
      return moment().add(1, 'days').format(format)
    }

    return false
  }

  /*
   * Send to the general channel information about the status of users.
   *
   * @param {Robot} robot - Robot instance.
   */
  function prepareDailyReport (robot) {
    const allUsers = Object.values(robot.brain.data.users)
    const informer = {}
    const today = moment()
    if ([6, 0].includes(today.day())) return
    let workFromHome = allUsers
      .filter(user => {
        if (user.vivaLasVegas && user.vivaLasVegas.dateOfWorkFromHome) {
          const date = moment(user.vivaLasVegas.dateOfWorkFromHome[1], CREATION_DATE_FORMAT)

          return isEqualDate(today, date)
        }
      })
    let backFromVacation = allUsers
      .filter(user => {
        if (user.vivaLasVegas && user.vivaLasVegas.leaveStart) {
          // It sometimes happened that leaveEnd is undefined.
          if (!user.vivaLasVegas.leaveEnd) {
            robot.logger.error(`In backFromVacation leaveEnd attribute of @${user.name} is missing.`)
            robot.logger.error(JSON.stringify(user))
            return false
          }
          const d = user.vivaLasVegas.leaveEnd.day
          const m = user.vivaLasVegas.leaveEnd.month
          const y = user.vivaLasVegas.leaveEnd.year
          const leaveEnd = moment(`${d}.${m}.${y}`, CREATION_DATE_FORMAT).add(1, 'days')
          return isEqualDate(today, leaveEnd)
        }
      })
    let wentOnVacation = allUsers
      .filter(user => {
        if (user.vivaLasVegas && user.vivaLasVegas.leaveStart) {
          const d = user.vivaLasVegas.leaveStart.day
          const m = user.vivaLasVegas.leaveStart.month
          const y = user.vivaLasVegas.leaveStart.year
          const leaveStart = moment(`${d}.${m}.${y}`, CREATION_DATE_FORMAT)

          return isEqualDate(today, leaveStart)
        }
      })
    let sickPeople = allUsers.filter(user => user.sick && !user.sick.isWork)
    let sickPeopleWorkHome = allUsers.filter(user => user.sick && user.sick.isWork)

    informer[`Из дома работа${workFromHome.length > 1 ? 'ют' : 'ет'}`] = workFromHome
    informer[`${wentOnVacation.length > 1 ? 'Ушли' : 'Пользователь ушел'} в отпуск`] = wentOnVacation
    informer[`${backFromVacation.length > 1 ? 'Вернулись' : 'Пользователь вернулся'} из отпуска`] = backFromVacation
    informer[`Боле${sickPeople.length > 1 ? 'ют' : 'ет'}`] = sickPeople
    informer[`Боле${sickPeopleWorkHome.length > 1 ? 'ют' : 'ет'} (работа из дома)`] = sickPeopleWorkHome
    // Form mesage
    const message = []
    for (const key in informer) {
      const value = informer[key]

      if (value && value.length) {
        message.push(`${key}: ${value.map(user => `${value.length > 1 ? '\n' : ''}@${user.name}`).join('')}`)
      }
    }
    if (message.length) {
      const today = `*Сегодня:*\n`
      robot.messageRoom('general', today + message.join('\n'))
    }
  }

  function sortingByValue (a, b, format) {
    const firstDate = moment(`${a.leaveStart.day}.${a.leaveStart.month}.${a.leaveStart.year}`, format).format(format)
    const secondDate = moment(`${b.leaveStart.day}.${b.leaveStart.month}.${b.leaveStart.year}`, format).format(format)

    let first = moment(firstDate, format).unix()
    let second = moment(secondDate, format).unix()

    return first - second
  }

  function sortingByStatus (a, b) {
    if (!a.reportToCustomer && b.reportToCustomer) return -1
    if (a.reportToCustomer && !b.reportToCustomer) return 1
  }

  /**
   * Get all existing user
   *
   * @param {Robot} robot - Hubot instance.
   */
  async function getAllExistingUser (robot) {
    const allUsers = Object.values(robot.brain.data.users)
      .map(user => {
        return routines.doesUserExist(robot, user).then((isExist) => {
          return { user, isExist }
        })
      })

    return (Promise.all(allUsers)
      .catch(() => { routines.rave(robot, 'Can\'t filter users') })
      .then(array => array.filter(user => user.isExist)))
  }

  /**
   * Extend all user's disease
   *
   * @param {Robot} robot - Hubot instance.
   */
  async function dailySickExtension (robot) {
    const allUsers = await getAllExistingUser(robot)
    const tomorrow = moment().add(1, 'day')

    for (const { user } of allUsers.filter(item => item.user.sick)) {
      if (GOOGLE_API && user.sick.eventId) {
        getEventFromCalendar(user.sick.eventId)
          .then(event => {
            event.data.end = { date: tomorrow.format('YYYY-MM-DD') }
            updateEventFromCalendar(user.sick.eventId, event.data)
          })
      }
    }
  }

  robot.respond(/(хочу в отпуск)|(@?(.+) хочет в отпуск)\s*/i, async function (msg) {
    const username = msg.match[1] ? msg.message.user.name : msg.match[3]
    const user = await routines.findUserByName(robot, username)

    if (!user) {
      msg.send(UNKNOWN_USER_MSG)
      return
    }

    user.vivaLasVegas = user.vivaLasVegas || {}
    const state = user.vivaLasVegas

    if (msg.match[2]) { // @username хочет в отпуск
      const admin = await routines.findUserByName(robot, msg.message.user.name)
      admin.vivaLasVegas = admin.vivaLasVegas || {}
      admin.vivaLasVegas.allocation = username

      if (!await routines.isAdmin(robot, admin.name)) {
        msg.send(ACCESS_DENIED_MSG)
        return
      }
    }

    if (state.n !== undefined && state.n !== INIT_STATE && state.n < CONFIRM_STATE) {
      const appeal = msg.match[1] ? 'ты хочешь' : `@${username} хочет`
      const leaveStart = state.leaveStart
      const leaveEnd = state.leaveEnd
      let infoMessage

      switch (state.n) {
        case 1: {
          infoMessage = '\n'
          break
        }
        case 2: {
          infoMessage = `\nИтак, ${appeal} в отпуск с ${moment(`${leaveStart.day}.${leaveStart.month}`, DATE_FORMAT).format('DD.MM')}.\n`
          break
        }
        case 3: {
          infoMessage = `\nИтак, ${appeal} уйти в отпуск с ${moment(`${leaveStart.day}.${leaveStart.month}`, DATE_FORMAT).format('DD.MM')} по ${moment(`${leaveEnd.day}.${leaveEnd.month}`, DATE_FORMAT).format('DD.MM')}.\n`
          break
        }
      }

      if (state.n === 3) {
        const message = routines.buildMessageWithButtons(
          `${ANGRY_MSG}${infoMessage}${statesMessages[state.n]}`,
          [
            ['Да', msg.match[1] ? 'Да, планирую' : 'Да, планирует'],
            ['Нет', msg.match[1] ? 'Нет, не планирую' : 'Нет, не планирует']
          ]
        )
        msg.send(message)
      } else {
        const message = statesMessages[state.n].replace('%s', appeal)
        msg.send(`${ANGRY_MSG}${infoMessage}${message}`)
      }

      return
    }

    if (state.requestStatus === APPROVED_STATUS) {
      if (msg.match[2]) { // @username хочет в отпуск
        msg.send('Заявка этого пользователя уже была одобрена.')
      } else {
        msg.send('Твоя предыдущая заявка была одобрена, так что сначала отгуляй этот отпуск.')
      }

      return
    }

    if (state.requestStatus === PENDING_STATUS) {
      if (msg.match[2]) { // @username хочет в отпуск
        msg.send('У этого пользователя уже есть заявка на отпуск.')
      } else {
        msg.send('Твоя заявка на отпуск уже отправлена. Дождись ответа.')
      }

      return
    }

    state.creationDate = moment().format(CREATION_DATE_FORMAT)
    state.n = FROM_STATE

    msg.send(`Ok, с какого числа? (${USER_FRIENDLY_DATE_FORMAT})`)
  })

  robot.respond(/работаю (из )?дома\s*/i, function (msg) {
    const state = getStateFromBrain(robot, msg.message.user.name)

    let dayOfWorkFromHome = new Stack(state.dateOfWorkFromHome)
    if (!dayOfWorkFromHome.canWork()) {
      msg.send(`Ты уже работаешь из дома ${dayOfWorkFromHome[1]}. Если хочешь все отменить, скажи 'не работаю из дома' :wink:.`)
      return
    }

    state.n = WAITING_DATE_STATE
    msg.send(`Ok, в какой день? (сегодня/завтра/${USER_FRIENDLY_DATE_FORMAT})`)
  })

  robot.respond(/не работаю (из )?дома\s*/i, function (msg) {
    const state = getStateFromBrain(robot, msg.message.user.name)
    const user = robot.brain.userForName(msg.message.user.name)

    let dayOfWorkFromHome = new Stack(state.dateOfWorkFromHome)
    if (!dayOfWorkFromHome.canWork()) {
      dayOfWorkFromHome.rollback()
      state.dateOfWorkFromHome = dayOfWorkFromHome
      state.dateRequested = null
      if (GOOGLE_API && user.vivaLasVegas.homeWorkEventId) {
        deleteEventFromCalendar(user.vivaLasVegas.homeWorkEventId)
      }
      if (user.vivaLasVegas.homeWorkEventId) {
        msg.send('Я тебя понял. :ok_hand: Убираю событие из календаря.')
      } else {
        msg.send('Я тебя понял. :ok_hand:')
      }
      delete user.vivaLasVegas.homeWorkEventId
    } else {
      msg.send('У тебя не запланирован день работы из дома, который можно было бы отменить, а прошлого не вернешь...')
    }
  })

  robot.respond(regExpMonthYear, async function (msg) {
    const adverb = adverbToDate(msg.match[1].toLowerCase(), OUTPUT_DATE_FORMAT)
    const date = adverb || moment(msg.match[2], DATE_FORMAT).format(OUTPUT_DATE_FORMAT)
    const customer = await routines.findUserByName(robot, msg.message.user.name)
    const state = customer.vivaLasVegas.allocation
      ? (await routines.findUserByName(robot, customer.vivaLasVegas.allocation)).vivaLasVegas
      : customer.vivaLasVegas

    let day = parseInt(moment(adverb, OUTPUT_DATE_FORMAT).date()) || parseInt(msg.match[3])
    let month = parseInt(moment(adverb, OUTPUT_DATE_FORMAT).month()) + 1 || parseInt(msg.match[4])

    if ([FROM_STATE, TO_STATE].includes(state.n) && !routines.isValidDate(date, DATE_FORMAT)) {
      msg.send(INVALID_DATE_MSG)

      return
    }

    if (state.n === FROM_STATE) {
      const today = moment().startOf('day')
      // moment().month() starts counting with 0
      const currentMonth = today.month() + 1
      let year

      if (currentMonth === month) {
        if (today.date() > day) {
          year = today.year() + 1
        } else {
          year = today.year()
        }
      } else if (currentMonth > month) {
        year = today.year() + 1
      } else {
        year = today.year()
      }

      if (!customer.vivaLasVegas.allocation) {
        const startDay = moment(`${day}.${month}.${year}`, 'D.M.YYYY')
        const daysBefore = startDay.diff(today, 'days')

        if (daysBefore < MINIMUM_DAYS_BEFORE_REQUEST) {
          const minDate = today.add(MINIMUM_DAYS_BEFORE_REQUEST, 'd').format('DD.MM.YYYY')
          let duration
          switch (daysBefore) {
            case 0:
              duration = 'уже сегодня'
              break
            case 1:
              duration = 'уже завтра'
              break
            default:
              duration = `только через ${noname(daysBefore)}`
              break
          }
          msg.send(`Нужно запрашивать отпуск минимум за ${noname(MINIMUM_DAYS_BEFORE_REQUEST)}, а твой - ${duration}. Попробуй выбрать дату позднее ${minDate}.`)
          return
        }
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
      const appeal = customer.vivaLasVegas.allocation
        ? `@${customer.vivaLasVegas.allocation} планирует`
        : 'ты планируешь'
      const leaveStart = state.leaveStart
      const leaveEnd = {}

      let year = leaveStart.month >= month && leaveStart.day >= day ? leaveStart.year + 1 : leaveStart.year

      const d1 = moment(`${leaveStart.day}.${leaveStart.month}.${leaveStart.year}`, 'D.M.YYYY')
      const d2 = moment(`${day}.${month}.${year}`, 'D.M.YYYY')

      let withWeekends = ''

      if (d2.day() >= 5) {
        d2.day(7)

        day = d2.date()
        month = d2.month() + 1
        year = d2.year()

        withWeekends = ' (учитывая выходные)'
      }

      const daysNumber = d2.diff(d1, 'days') + 1

      if (daysNumber > MAXIMUM_LENGTH_OF_LEAVE) {
        msg.send(`Отпуск продолжительностью ${noname(daysNumber)} выглядит круто (особенно если он оплачиваемый :joy:), но ты можешь претендовать максимум на ${noname(MAXIMUM_LENGTH_OF_LEAVE)}.`)

        return
      }

      leaveEnd.day = day
      leaveEnd.month = month
      leaveEnd.year = year

      state.leaveEnd = leaveEnd
      state.n = CONFIRM_STATE

      const buttonsMessage = routines.buildMessageWithButtons(
        `Значит ${appeal} находиться в отпуске ${noname(daysNumber)}${withWeekends}. Все верно?`,
        [
          ['Да', customer.vivaLasVegas.allocation ? 'Да, планирует' : 'Да, планирую'],
          ['Нет', customer.vivaLasVegas.allocation ? 'Нет, не планирует' : 'Нет, не планирую']
        ]
      )

      msg.send(buttonsMessage)
    }

    if (state.n === WAITING_DATE_STATE) {
      const dateOfWorkFromHome = new Stack(state.dateOfWorkFromHome)
      switch (dateOfWorkFromHome.checkDate(date)) {
        case 1:
          msg.send('Не валидная дата.')
          return
        case 2:
          msg.send(`Но ${date} уже прошло :rolling_eyes:. Выбери дату позднее ${moment().add(-1, 'day').format(OUTPUT_DATE_FORMAT)}.`)
          return
        case 3:
          msg.send('Нельзя запланировать день работы из дома больше, чем на две недели вперед.')
          return
        case 4:
          msg.send(`Ты не можешь взять еще один день на этой неделе. Попробуй на следующей.`)
          return
        default:
          dateOfWorkFromHome.push(date)
      }

      state.dateRequested = dateOfWorkFromHome[1]
      state.n = WAITING_CONFIRMATION_STATE
      const buttonsMessage = routines.buildMessageWithButtons(
        'Согласован ли этот день с руководителем/тимлидом?',
        [
          ['Да', 'Да, согласован'],
          ['Нет', 'Нет, не согласован']
        ]
      )
      msg.send(buttonsMessage)
    }
  })

  robot.respond(/(Да, планирует|Нет, не планирует)\s*/i, async msg => {
    const answer = msg.match[1].toLowerCase().trim()
    const customer = await routines.findUserByName(robot, msg.message.user.name)

    if (!customer.vivaLasVegas.allocation) {
      msg.send(CONFUSED_MSG)
      return
    }

    const user = await routines.findUserByName(robot, customer.vivaLasVegas.allocation)
    const state = user.vivaLasVegas

    if (state.n !== CONFIRM_STATE) {
      msg.send(CONFUSED_MSG)
      return
    }

    if (answer === 'да, планирует') {
      const from = moment(`${state.leaveStart.day}.${state.leaveStart.month}`, 'D.M')
      const to = moment(`${state.leaveEnd.day}.${state.leaveEnd.month}`, 'D.M')

      state.requestStatus = APPROVED_STATUS
      state.reportToCustomer = false

      let googleEvent = ''

      if (GOOGLE_API) {
        const startDay = from.format('YYYY-MM-DD')
        const endDay = to.add(1, 'day').format('YYYY-MM-DD')

        const eventId = await addEventToCalendar(startDay, endDay, user, GOOGLE_EVENT_VACATION)

        state.eventId = eventId
        googleEvent = 'Событие добавлено в календарь.'
      }

      const message = `Пользователем @${customer.name} только что создана заявка на отпуск @${user.name} c ${from.format('DD.MM')} по ${to.format('DD.MM')}.`
      robot.messageRoom(LEAVE_COORDINATION_CHANNEL, message)
      msg.send(`Заявка на отпуск для пользователя @${user.name} создана и одобрена. ${googleEvent}`)
      const question = routines.buildMessageWithButtons(
        `Привет, тебе оформлен отпуск с ${from.format('DD.MM')} по ${to.format('DD.MM')}. Заказчик предупрежден?`,
        [
          ['Да', 'Да, предупрежден'],
          ['Нет', 'Нет, не предупрежден']
        ]
      )
      robot.adapter.sendDirect({ user: { name: user.name } }, question)
    } else if (answer === 'нет, не планирует') {
      msg.send('Я прервал процесс формирования заявки на отпуск.')
    }

    delete state.n
    delete customer.vivaLasVegas.allocation
  })

  robot.respond(/(Да, планирую|Нет, не планирую)\s*$/i, msg => {
    const username = msg.message.user.name
    const state = getStateFromBrain(robot, username)
    const answer = msg.match[1].toLowerCase().trim()

    if (state.n === CONFIRM_STATE) {
      if (answer === 'да, планирую') {
        const deadline = moment(state.creationDate, CREATION_DATE_FORMAT).add(MAXIMUM_LENGTH_OF_WAIT, 'days').format('DD.MM')
        const from = moment(`${state.leaveStart.day}.${state.leaveStart.month}`, 'D.M').format('DD.MM')
        const to = moment(`${state.leaveEnd.day}.${state.leaveEnd.month}`, 'D.M').format('DD.MM')

        const buttonsMessage = routines.buildMessageWithButtons(
          `Пользователь @${username} хочет в отпуск с ${from} по ${to}. Ответ нужно дать до ${deadline}.`,
          [
            ['Одобрить', `${robot.alias} одобрить заявку @${username}`],
            ['Отклонить', `${robot.alias} отклонить заявку @${username}`]
          ]
        )
        robot.messageRoom(LEAVE_COORDINATION_CHANNEL, buttonsMessage)

        state.requestStatus = PENDING_STATUS
        state.reportToCustomer = false

        msg.send(`Заявка на отпуск отправлена. Ответ поступит не позже чем через ${noname(MAXIMUM_LENGTH_OF_WAIT)}.`)
      } else {
        msg.send('Я прервал процесс формирования заявки на отпуск.')
      }

      state.n = INIT_STATE
    }
  })

  robot.respond(/(Да, согласован|Нет, не согласован)\s*$/i, async msg => {
    const username = msg.message.user.name
    const state = getStateFromBrain(robot, username)
    const answer = msg.match[1].toLowerCase().trim()

    if (state.n === WAITING_CONFIRMATION_STATE) {
      if (answer === 'да, согласован') {
        let eventId
        let dayOfWorkFromHome = new Stack(state.dateOfWorkFromHome)
        state.n = INIT_STATE
        dayOfWorkFromHome.push(state.dateRequested)
        state.dateOfWorkFromHome = dayOfWorkFromHome
        state.dateRequested = ''
        if (GOOGLE_API) {
          const date = moment(`${dayOfWorkFromHome[1]}`, DATE_FORMAT)
          const startDay = date.format('YYYY-MM-DD')
          const endDay = date.add(1, 'days').format('YYYY-MM-DD')
          const user = robot.brain.userForName(username)

          eventId = await addEventToCalendar(startDay, endDay, user, GOOGLE_EVENT_WORK_FROM_HOME)
          user.vivaLasVegas.homeWorkEventId = eventId
        }
        if (eventId) {
          msg.send(`Отлично. Я создал событие в календаре. Ты работаешь из дома ${dayOfWorkFromHome[1]}.`)
        } else {
          msg.send(`Отлично. Ты работаешь из дома ${dayOfWorkFromHome[1]}.`)
        }
      } else {
        state.n = INIT_STATE
        msg.send('Тогда сначала согласуй, а потом пробуй еще раз (ты знаешь где меня найти).')
      }
    }
  })

  robot.respond(/(Да, предупрежден|Нет, не предупрежден)\s*$/i, msg => {
    const username = msg.message.user.name
    const state = getStateFromBrain(robot, username)
    const answer = msg.match[1].toLowerCase()

    if (!state.reportToCustomer) {
      if (answer === 'да, предупрежден') {
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

    if (state.requestStatus === APPROVED_STATUS) {
      cleanupState(state)

      if (msg.message.room !== LEAVE_COORDINATION_CHANNEL) {
        robot.messageRoom(LEAVE_COORDINATION_CHANNEL, `Пользователь @${msg.message.user.name} отменил заявку на отпуск пользователя @${username}.`)
      }

      if (GOOGLE_API && state.eventId) {
        deleteEventFromCalendar(state.eventId)
        delete state.eventId
      }

      robot.adapter.sendDirect({ user: { name: username } }, `Упс, пользователь @${msg.message.user.name} только что отменил твою заявку на отпуск.`)
      msg.send(`Отпуск пользователя @${username} отменен.`)
    } else if (state.requestStatus === PENDING_STATUS) {
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
      const user = robot.brain.userForName(username)
      let result

      if (state.requestStatus !== PENDING_STATUS) {
        msg.send('У этого пользователя нет ожидающей ответа заявки.')

        return
      }

      if (action === 'одобрить') {
        result = 'одобрена'
        state.requestStatus = APPROVED_STATUS

        const start = state.leaveStart
        const leaveStart = moment(
          `${start.day}.${start.month}.${start.year}`,
          'DD.MM.YYYY'
        ).format('YYYY-MM-DD')

        const end = state.leaveEnd
        const leaveEnd = moment(
          `${end.day}.${end.month}.${end.year}`,
          'DD.MM.YYYY'
        ).add(1, 'day').format('YYYY-MM-DD')

        if (GOOGLE_API) {
          const eventId = await addEventToCalendar(leaveStart, leaveEnd, user, GOOGLE_EVENT_VACATION)
          state.eventId = eventId
        }
      } else {
        result = 'отклонена'
        cleanupState(state)
      }

      if (msg.message.room !== LEAVE_COORDINATION_CHANNEL) {
        const admin = msg.message.user.name
        robot.messageRoom(LEAVE_COORDINATION_CHANNEL, `Заявка на отпуск пользователя @${username} была ${result} пользователем @${admin}.`)
      }

      msg.send(`Заявка @${username} ${result}. Я отправлю этому пользователю уведомление об этом.`)

      robot.adapter.sendDirect({ user: { name: username } }, `Заявка на отпуск ${result}.`)
    } else {
      msg.send(UNKNOWN_USER_MSG)
    }
  })

  /**
   * Overwrites vacation dates.
   *
   * @example viva reset @username DD.MM.YYYY-DD.MM.YYYY
   */
  robot.respond(/(viva reset @?(.+) (\d{1,2}\.\d{1,2}\.\d{4}|\*)[ -](\d{1,2}\.\d{1,2}\.\d{4}|\*))\s*/i, async (msg) => {
    if (!await routines.isAdmin(robot, msg.message.user.name)) {
      msg.send(ACCESS_DENIED_MSG)
      return
    }

    const username = msg.match[2]
    const leaveStart = msg.match[3]
    const leaveEnd = msg.match[4]

    if (![leaveStart, leaveEnd].every(item => item === '*' || routines.isValidDate(item, 'D.M.YYYY'))) {
      msg.send(INVALID_DATE_MSG)

      return
    }

    const users = Object.values(robot.brain.data.users)
      .map(user => {
        return routines.doesUserExist(robot, user).then((isExist) => {
          return { user, isExist }
        })
      })

    const filteredUser = (await Promise.all(users)
      .then(array => array.filter(item => item.isExist)))
      .find(user => user.user.name === username)

    const find = Object.values(robot.brain.data.users)
      .find(user => user.id === filteredUser.user.id)

    if (find) {
      let day, month, year
      const dates = []

      if (leaveStart !== '*') {
        day = parseInt(leaveStart.split('.')[0])
        month = parseInt(leaveStart.split('.')[1])
        year = parseInt(leaveStart.split('.')[2])
        find.vivaLasVegas.leaveStart = { day, month, year }

        dates.leaveStart = moment(`${day}.${month}.${year}`, 'D.M.YYYY').format('DD.MM.YYYY')
      } else {
        const leaveDate = Object.values(find.vivaLasVegas.leaveStart).join('.')
        dates.leaveStart = moment(leaveDate, 'D.M.YYYY').format('DD.MM.YYYY')
      }

      if (leaveEnd !== '*') {
        day = parseInt(leaveEnd.split('.')[0])
        month = parseInt(leaveEnd.split('.')[1])
        year = parseInt(leaveEnd.split('.')[2])
        find.vivaLasVegas.leaveEnd = { day, month, year }
        dates.leaveEnd = moment(`${day}.${month}.${year}`, 'D.M.YYYY').format('DD.MM.YYYY')
      } else {
        const leaveDate = Object.values(find.vivaLasVegas.leaveEnd).join('.')
        dates.leaveEnd = moment(leaveDate, 'D.M.YYYY').format('DD.MM.YYYY')
      }

      find.vivaLasVegas.requestStatus = APPROVED_STATUS
      msg.send(`Даты отпуска успешно перезаписаны!\n@${username} в отпуске с ${dates.leaveStart} по ${dates.leaveEnd}.`)
    } else {
      msg.send('*Ошибка*. Не удалось найти пользователя.')
    }
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

  robot.respond(/(я )?(болею|заболел)\s*$/i, async msg => {
    const user = robot.brain.userForId(msg.message.user.id)

    // if already sick
    if (user.sick) {
      msg.send('Я уже слышал, что ты болеешь. :thinking:')

      return
    }

    const message = routines.buildMessageWithButtons(
      'Очень жаль. Ты в состоянии работать из дома в эти дни?',
      [
        ['Да', 'Болею и работаю'],
        ['Нет', 'Болею и не работаю']
      ]
    )

    user.sickConfirming = true

    msg.send(message)
  })

  robot.respond(/(Болею и работаю|Болею и не работаю)\s*/i, msg => {
    const user = robot.brain.userForId(msg.message.user.id)

    if (user.sick) return
    if (!(typeof user.sickConfirming === 'boolean')) return

    user.sickConfirming = msg.match[1].toLowerCase()

    const message = routines.buildMessageWithButtons(
      'Я понял. Согласовано ли отсутствие с руководителем/тимлидом?',
      [
        ['Да', 'Да, они предупреждены, что я болею'],
        ['Нет', 'Нет, они не предупреждены, что я болею']
      ]
    )

    msg.send(message)
  })

  robot.respond(/(Да, они предупреждены, что я болею|Нет, они не предупреждены, что я болею)/i, async msg => {
    const user = robot.brain.userForId(msg.message.user.id)
    const today = moment()
    const tomorrow = moment().add(1, 'days')

    if (user.sick) return
    if (!(typeof user.sickConfirming === 'string')) return

    if (msg.match[1].toLowerCase() === 'да, они предупреждены, что я болею') {
      const isWork = user.sickConfirming === 'болею и работаю'

      if (!user.sick) {
        user.sick = Object()
      }

      let isCalendar = String()
      if (GOOGLE_API) {
        const eventId = await addEventToCalendar(
          today.format('YYYY-MM-DD'),
          tomorrow.format('YYYY-MM-DD'),
          user,
          isWork ? GOOGLE_EVENT_SICK_WITH_WORK : GOOGLE_EVENT_SICK
        )

        isCalendar = ' Я добавил событие в календарь.'
        user.sick.eventId = eventId
      }

      user.sick.start = today.format(CREATION_DATE_FORMAT)
      user.sick.isWork = isWork
      delete user.sickConfirming

      robot.messageRoom(
        LEAVE_COORDINATION_CHANNEL,
        `@${user.name} болеет и ${isWork ? 'работает' : 'не может работать'} из дома`
      )

      msg.send(`Ok. Выздоравливай поскорее.${isCalendar} Когда ты выйдешь на работу, скажи мне \`я не болею\`.`)
    } else {
      delete user.sickConfirming
      msg.send('Тогда сначала предупреди, а потом вернись и повтори все снова!')
    }
  })

  robot.respond(/(я )?(не болею|выздоровел)\s*/i, msg => {
    const user = robot.brain.userForId(msg.message.user.id)

    if (!user.sick) {
      msg.send('Я ничего не знал о твоей болезни. :thinking:')

      return
    }

    let isCalendar = String()
    if (GOOGLE_API && user.sick.eventId) {
      getEventFromCalendar(user.sick.eventId)
        .then(event => {
          const startDate = moment(user.sick.start, 'DD.MM.YYYY')
          const yesterday = moment()

          if (isEqualDate(startDate, yesterday)) {
            isCalendar = ' Я удалил событие из календаря.'
            return deleteEventFromCalendar(user.sick.eventId)
          } else {
            event.data.end = { date: yesterday.format('YYYY-MM-DD') }
            isCalendar = ' Я исправил событие в календаре.'
            return updateEventFromCalendar(user.sick.eventId, event.data)
          }
        }).then(() => {
          delete user.sick

          msg.send(`Рад видеть тебя снова!${isCalendar}`)
        })
    } else if (user.sick) {
      delete user.sick

      msg.send(`Рад видеть тебя снова!`)
    }
  })

  if (VIVA_REMINDER_SCHEDULER) {
    schedule.scheduleJob(VIVA_REMINDER_SCHEDULER, () => sendRemindersToChannel(robot))

    schedule.scheduleJob(VIVA_REMINDER_SCHEDULER, () => checkLeaveTimeLeft(robot, 14, 30, 1))

    schedule.scheduleJob(VIVA_REPORT_SCHEDULER, () => dailySickExtension(robot))

    // Warning: prepareDailyReport should be called before resetLeaveStatus to access unchanged user attrs.
    schedule.scheduleJob(VIVA_REPORT_SCHEDULER, () => prepareDailyReport(robot))

    schedule.scheduleJob(VIVA_REPORT_SCHEDULER, () => resetLeaveStatus(robot))
  }
}
