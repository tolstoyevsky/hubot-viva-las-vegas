const moment = require('moment')
const routines = require('hubot-routines')

const vars = require('./../vars')
const utils = require('./../utils')

/**
 * Extend all user's disease
 *
 * @param {Robot} robot - Hubot instance.
 */
module.exports = async (robot) => {
  const users = await routines.getAllUsers(robot)
  const tomorrow = moment().add(1, 'day')

  if (!vars.GOOGLE_API) return

  for (const user of users.filter(user => user.sick && user.sick.eventId)) {
    utils.getEventFromCalendar(robot, user.sick.eventId)
      .then(event => {
        event.data.end = { date: tomorrow.format('YYYY-MM-DD') }
        utils.updateEventFromCalendar(robot, user.sick.eventId, event.data)
      })
  }
}
