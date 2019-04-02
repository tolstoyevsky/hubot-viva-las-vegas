const routines = require('hubot-routines')
const moment = require('moment')

const vars = require('../vars')
const utils = require('../utils')

const { Stack } = require('../stack')

module.exports = async msg => {
  const username = msg.message.user.name
  const state = await utils.getStateFromBrain(msg.robot, username)
  const answer = msg.match[1].toLowerCase().trim()

  if (state.n === vars.WAITING_CONFIRMATION_STATE) {
    if (answer === 'да, согласован') {
      state.n = vars.INIT_STATE
      const dayOfWorkFromHome = new Stack(state.dateOfWorkFromHome)
      dayOfWorkFromHome.push(state.dateRequested)
      state.dateOfWorkFromHome = dayOfWorkFromHome
      state.dateRequested = ''
      if (vars.GOOGLE_API) {
        const date = moment(`${dayOfWorkFromHome[1]}`, vars.DATE_FORMAT)
        const startDay = date.format('YYYY-MM-DD')
        const endDay = date.add(1, 'days').format('YYYY-MM-DD')
        const user = await routines.findUserByName(msg.robot, username)

        utils.addEventToCalendar(msg.robot, startDay, endDay, user, vars.GOOGLE_EVENT_WORK_FROM_HOME)
          .then(eventId => { user.vivaLasVegas.homeWorkEventId = eventId })

        msg.send(`Отлично. Я создал событие в календаре. Ты работаешь из дома ${dayOfWorkFromHome[1]}.`)
      } else {
        msg.send(`Отлично. Ты работаешь из дома ${dayOfWorkFromHome[1]}.`)
      }
    } else {
      state.n = vars.INIT_STATE
      msg.send('Тогда сначала согласуй, а потом пробуй еще раз (ты знаешь где меня найти).')
    }
  }
}
