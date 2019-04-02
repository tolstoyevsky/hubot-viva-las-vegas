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
  const allUsers = await routines.getAllUsers(robot)
  const tomorrow = moment().add(1, 'day')

  for (const { user } of allUsers.filter(item => item.user.sick)) {
    if (vars.GOOGLE_API && user.sick.eventId) {
      utils.getEventFromCalendar(robot, user.sick.eventId)
        .then(event => {
          event.data.end = { date: tomorrow.format('YYYY-MM-DD') }
          utils.updateEventFromCalendar(robot, user.sick.eventId, event.data)
        })
    }
  }
}
