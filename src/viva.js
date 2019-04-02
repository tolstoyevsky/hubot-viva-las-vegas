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
//      hubot @username хочет отгул - initiates a new time off request for the specified user
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
  const routines = require('hubot-routines')
  const schedule = require('node-schedule')

  const vars = require('./vars')

  if (!(await routines.isBotInRoom(robot, vars.LEAVE_COORDINATION_CHANNEL))) {
    routines.rave(robot, `Hubot is not in the group or channel named '${vars.LEAVE_COORDINATION_CHANNEL}'`)
    return
  }

  const users = await routines.getAllUsers(robot)
  users.forEach(user => {
    if (user.vivaLasVegas && user.vivaLasVegas.dateOfWorkFromHome && typeof user.vivaLasVegas.dateOfWorkFromHome === 'string') {
      user.vivaLasVegas.dateOfWorkFromHome = [(user.vivaLasVegas.dateOfWorkFromHome), user.vivaLasVegas.dateOfWorkFromHome]
      console.log('*')
    }
  })

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

    vars.GOOGLE_JWT_CLIENT = new google.auth.JWT(
      data.client_email,
      null,
      data.private_key,
      SCOPES,
      null
    )

    return vars.GOOGLE_JWT_CLIENT.authorize()
  }

  /**
   * Get Google calendar id.
   *
   * @returns {Void | String} - Calendar id.
   */
  async function getCalendar () {
    return vars.GOOGLE_CALENDAR.calendarList.list()
      .then(result => {
        if (!result.data.items.length) {
          throw Error('There are no calendars.')
        }

        const calendar = result.data.items.find(item => item.summary === vars.GOOGLE_CALENDAR_NAME)

        if (!calendar) {
          throw Error('Couldn\'t find the calendar with the specified name.')
        }

        return calendar.id
      })
  }

  /** Google API Auth */
  if (vars.GOOGLE_API) {
    const AUTH_TO_GOOGLE_API = {
      private_key: vars.GOOGLE_PRIVATE_KEY,
      client_email: vars.GOOGLE_CLIENT_EMAIL
    }

    if (!vars.GOOGLE_CLIENT_EMAIL || !vars.GOOGLE_PRIVATE_KEY) {
      throw Error('The params related to Google Calendar API wasn\'t specified.')
    }

    googleAuth(AUTH_TO_GOOGLE_API)
      .then(result => {
        if (!result) {
          throw Error('Couldn\'t be authenticated.')
        }

        vars.GOOGLE_CALENDAR = google.calendar({ auth: vars.GOOGLE_JWT_CLIENT, version: 'v3' })

        getCalendar()
          .then(id => { vars.GOOGLE_CALENDAR_ID = id })
      })
      .catch(err => {
        routines.rave(robot, err.message)
      })
  }

  robot.respond(/(хочу в отпуск)|(@?(.+) хочет в отпуск)\s*/i, require('./routes/leave/leaveStart'))
  robot.respond(/работаю (из )?дома\s*/i, require('./routes/work-from-home/workFromHome'))
  robot.respond(/не работаю (из )?дома\s*/i, require('./routes/work-from-home/workFromHomeCancel'))
  robot.respond(vars.regExpMonthYear, require('./routes/monthYearRoute'))
  robot.respond(/(Да, планирует|Нет, не планирует)\s*/i, require('./routes/leave/userIsPlanningToGoOnLeave'))
  robot.respond(/(Да, планирую|Нет, не планирую)\s*$/i, require('./routes/leave/iAmPlanningToGoOnLeave'))
  robot.respond(/(Да, согласован|Нет, не согласован)\s*$/i, require('./routes/work-from-home/workFromHomeAgree'))
  robot.respond(/(Да, предупрежден|Нет, не предупрежден)\s*$/i, require('./routes/leave/customerNotified'))
  robot.respond(/(отменить заявку @?(.+))\s*/i, require('./routes/leave/leaveRequestCancel'))
  robot.respond(/(одобрить|отклонить) заявку @?(.+)\s*/i, require('./routes/leave/leaveRequestApprove'))
  robot.respond(/список заявок\s*/i, require('./routes/leave/requestsList'))
  robot.respond(/(я )?(болею|заболел)\s*$/i, require('./routes/ill/iAmIll'))
  robot.respond(/(Болею и работаю|Болею и не работаю)\s*/i, require('./routes/ill/illAgree'))
  robot.respond(/(Да, они предупреждены, что я болею|Нет, они не предупреждены, что я болею)/i, require('./routes/ill/yesTheyAreNotified'))
  robot.respond(/(я )?(не болею|выздоровел)\s*/i, require('./routes/ill/iAmNotIll'))
  robot.respond(/(@?(.+) хочет отгул)\s*/i, require('./routes/time-off/userWantsTimeOff'))
  robot.respond(/(с отработкой)|(за свой счет)|(в счет отпуска)\s*/i, require('./routes/time-off/timeOffType'))
  robot.respond(/(отгул не нужен)\s*/i, require('./routes/time-off/timeOffIsNotNeeded'))
  /**
   * Overwrites vacation dates.
   *
   * @example viva reset @username DD.MM.YYYY-DD.MM.YYYY
   */
  robot.respond(/(viva reset @?(.+) (\d{1,2}\.\d{1,2}\.\d{4}|\*)[ -](\d{1,2}\.\d{1,2}\.\d{4}|\*))\s*/i, require('./routes/leave/vivaReset'))

  if (vars.VIVA_REMINDER_SCHEDULER) {
    schedule.scheduleJob(vars.VIVA_REMINDER_SCHEDULER, () => require('./schedulers/sendReminderToChannel')(robot))
    schedule.scheduleJob(vars.VIVA_REMINDER_SCHEDULER, () => require('./schedulers/checkLeaveTimeLeft')(robot, 14, 30, 1))
  }

  if (vars.VIVA_REPORT_SCHEDULER) {
    schedule.scheduleJob(vars.VIVA_REPORT_SCHEDULER, () => require('./schedulers/dailySickExtension')(robot))
    // Warning: prepareDailyReport should be called before resetLeaveStatus to access unchanged user attrs.
    schedule.scheduleJob(vars.VIVA_REPORT_SCHEDULER, () => require('./schedulers/prepareDailyReport')(robot))
    schedule.scheduleJob(vars.VIVA_REPORT_SCHEDULER, () => require('./schedulers/resetLeaveStatus')(robot))
  }
}
