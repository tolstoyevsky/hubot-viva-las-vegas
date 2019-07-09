const routines = require('hubot-routines')
const moment = require('moment')

const vars = require('../../vars')
const utils = require('../../utils')
const { AbstractView } = require('hubot-engine')
const { WORK_FROM_HOME_PERMISSION } = require('../../vars')

class View extends AbstractView {
  init (options) {
    options.app = 'workFromHome'
    options.permissions = [WORK_FROM_HOME_PERMISSION]
  }

  async callback (msg) {
    const username = msg.message.user.name
    const state = await utils.getStateFromBrain(msg.robot, username)
    const answer = msg.match[1].toLowerCase().trim()

    if (state.n === vars.WAITING_CONFIRMATION_STATE) {
      if (answer === 'да, согласован') {
        const { dateRequested } = state

        state.n = vars.INIT_STATE

        state.dateOfWorkFromHome = state.dateOfWorkFromHome || []
        state.dateOfWorkFromHome.push({ date: dateRequested })
        state.dateRequested = null

        if (vars.GOOGLE_API) {
          const date = moment(dateRequested, vars.CREATION_DATE_FORMAT)
          const startDay = date.format('YYYY-MM-DD')
          const endDay = date.add(1, 'days').format('YYYY-MM-DD')
          const user = await routines.findUserByName(msg.robot, username)
          const event = state.dateOfWorkFromHome.find(item => item.date === dateRequested)

          utils.addEventToCalendar(msg.robot, startDay, endDay, user, vars.GOOGLE_EVENT_WORK_FROM_HOME)
            .then(eventId => { event.eventId = eventId })

          msg.send(`Отлично. Я создал событие в календаре. Ты работаешь из дома ${dateRequested}.`)
        } else {
          msg.send(`Отлично. Ты работаешь из дома ${dateRequested}.`)
        }

        this.app.clear()
      } else {
        state.n = vars.INIT_STATE
        msg.send('Тогда сначала согласуй, а потом пробуй еще раз (ты знаешь где меня найти).')

        this.app.clear()
      }
    }
  }
}

module.exports = View
