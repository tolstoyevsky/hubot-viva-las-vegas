const moment = require('moment')
const routines = require('hubot-routines')

const vars = require('./vars')

/* GOOGLE CALENDAR */

/**
 * Add a new event to the calendar.
 *
 * @param {String} start
 * @param {String} end
 * @param {Object} user
 */
function addEventToCalendar (robot, start, end, user, type, description) {
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

  if (description) {
    event.description = description
  }

  return vars.GOOGLE_CALENDAR.events.insert({
    calendarId: vars.GOOGLE_CALENDAR_ID,
    resource: event
  })
    .then(event => event.data.id)
    .catch(err => {
      routines.rave(robot, `An error occurred when attempting to add an event to the calendar.\n${err.message}`)
    })
}

/**
 * Delete the event from the calendar by id.
 *
 * @param {string} eventId - Event id.
 */
function deleteEventFromCalendar (robot, eventId) {
  return vars.GOOGLE_CALENDAR.events.delete({
    calendarId: vars.GOOGLE_CALENDAR_ID,
    eventId: eventId
  }).catch(err => {
    routines.rave(robot, `An error occurred when attempting to delete an event from the calendar.\n${err.message}`)
  })
}

/**
 * Get the event from the calendar by id.
 *
 * @param {string} eventId - Event id.
 */
function getEventFromCalendar (robot, eventId) {
  return vars.GOOGLE_CALENDAR.events.get({
    calendarId: vars.GOOGLE_CALENDAR_ID,
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
function updateEventFromCalendar (robot, eventId, resource) {
  return vars.GOOGLE_CALENDAR.events.update({
    calendarId: vars.GOOGLE_CALENDAR_ID,
    eventId,
    resource
  }).catch((err) => {
    routines.rave(robot, `An error occurred when attempting to update an event from the calendar.\n${err.message}`)
  })
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

/**
 * @param {Object} state
 *
 * @returns {void}
 */
function cleanupState (state) {
  state.n = vars.INIT_STATE
  delete state.leaveStart
  delete state.leaveEnd
  delete state.requestStatus
}

/**
 * @param {Robot} robot
 * @param {string} username
 *
 * @returns {Object}
 */
async function getStateFromBrain (robot, username) {
  const user = await routines.findUserByName(robot, username)

  user.vivaLasVegas = user.vivaLasVegas || {}

  return user.vivaLasVegas
}

/**
 * Check if two specified dates are the same.
 *
 * @param {moment} firstDate
 * @param {moment} secondsDate
 * @returns {boolean}
 */
function isEqualDate (firstDate, secondsDate) {
  const a = firstDate.startOf('day')
  const b = secondsDate.startOf('day')
  return a.diff(b, 'days') === 0
}

/**
 * @param {number} daysNumber
 *
 * @returns {string}
 */
function noname (daysNumber) {
  const exceptionDaysEnd = ['11', '12', '13', '14']
  if (daysNumber.toString().endsWith(exceptionDaysEnd)) {
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

module.exports = {
  addEventToCalendar,
  deleteEventFromCalendar,
  getEventFromCalendar,
  updateEventFromCalendar,
  adverbToDate,
  cleanupState,
  getStateFromBrain,
  isEqualDate,
  noname
}
