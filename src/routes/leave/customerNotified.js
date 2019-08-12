const vars = require('../../vars')
const utils = require('../../utils')
const { AbstractView } = require('hubot-engine')

class View extends AbstractView {
  async callback (msg) {
    const username = msg.message.user.name
    const state = await utils.getStateFromBrain(msg.robot, username)
    const answer = msg.match[1].toLowerCase().trim()

    if (!state.reportToCustomer) {
      if (answer === 'да, предупрежден') {
        state.reportToCustomer = true
        msg.robot.messageRoom(vars.LEAVE_COORDINATION_CHANNEL, `Пользователь @${username} только что сообщил, что предупредил заказчика о своем отпуске.`)
        msg.send(':thumbsup:')
      } else {
        msg.send('Обязательно предупреди! :fearful:')
      }
    }
  }
}

module.exports = View
