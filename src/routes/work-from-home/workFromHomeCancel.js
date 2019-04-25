const moment = require('moment')
const routines = require('hubot-routines')

const vars = require('../../vars')
const utils = require('../../utils')

module.exports = async (msg) => {
  const state = await utils.getStateFromBrain(msg.robot, msg.message.user.name)

  state.dateOfWorkFromHome = state.dateOfWorkFromHome || []

  const upcomingEvents = state.dateOfWorkFromHome.filter(item => {
    const today = moment().startOf('day')
    const event = moment(
      typeof item === 'string' ? item : item.date,
      vars.CREATION_DATE_FORMAT
    )
    return event.isSameOrAfter(today)
  })

  if (upcomingEvents.length === 0) {
    return msg.send('У тебя нет запланированных дней работы из дома.')
  }

  if (upcomingEvents.length === 1) {
    const scheduledDay = upcomingEvents[0]
    state.dateOfWorkFromHome = state.dateOfWorkFromHome.filter(item => {
      if (typeof item === 'string') {
        return item !== (typeof scheduledDay === 'string' ? scheduledDay : scheduledDay.date)
      } else {
        return item.date !== scheduledDay.date
      }
    })

    if (vars.GOOGLE_API && scheduledDay.eventId) {
      utils.deleteEventFromCalendar(msg.robot, scheduledDay.eventId)
    }

    return msg.send(`У тебя был запланирован день работы из дома на ${typeof scheduledDay === 'string' ? scheduledDay : scheduledDay.date}. Я отменил его.`)
  }

  if (upcomingEvents.length >= 2) {
    const buttons = upcomingEvents.map(item => {
      if (typeof item === 'string') {
        return [item, `Не работаю из дома ${item}`]
      } else {
        return [item.date, `Не работаю из дома ${item.date}`]
      }
    })
    buttons.push(['Отмена', 'Я не отменяю работу из дома'])
    const message = routines.buildMessageWithButtons(
      'У тебя запланировано несколько дней работы из дома. О каком идет речь?',
      buttons
    )
    msg.send(message)
  }
}
