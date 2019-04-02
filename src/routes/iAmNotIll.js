const moment = require('moment')

const vars = require('./../vars')
const utils = require('./../utils')

module.exports = msg => {
  const user = msg.message.user

  if (!user.sick) {
    msg.send('Я ничего не знал о твоей болезни. :thinking:')

    return
  }

  let isCalendar = String()

  if (vars.GOOGLE_API && user.sick.eventId) {
    utils.getEventFromCalendar(msg.robot, user.sick.eventId)
      .then(event => {
        const startDate = moment(user.sick.start, 'DD.MM.YYYY')
        const yesterday = moment()

        if (utils.isEqualDate(startDate, yesterday)) {
          isCalendar = ' Я удалил событие из календаря.'
          return utils.deleteEventFromCalendar(msg.robot, user.sick.eventId)
        } else {
          event.data.end = { date: yesterday.format('YYYY-MM-DD') }
          isCalendar = ' Я исправил событие в календаре.'
          return utils.updateEventFromCalendar(msg.robot, user.sick.eventId, event.data)
        }
      }).then(() => {
        delete user.sick

        msg.send(`Рад видеть тебя снова!${isCalendar}`)
      })
  } else if (user.sick) {
    delete user.sick

    msg.send(`Рад видеть тебя снова!`)
  }
}
