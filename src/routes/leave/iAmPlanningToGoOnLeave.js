const moment = require('moment')
const routines = require('hubot-routines')

const vars = require('../../vars')
const utils = require('../../utils')
const { AbstractView } = require('hubot-engine')

class View extends AbstractView {
  init (options) {
    options.app = 'leave'
  }

  async callback (msg) {
    const username = msg.message.user.name
    const state = await utils.getStateFromBrain(msg.robot, username)
    const answer = msg.match[1].toLowerCase().trim()

    if (state.n === vars.CONFIRM_STATE) {
      if (answer === 'да, планирую') {
        const deadline = moment(state.creationDate, vars.CREATION_DATE_FORMAT).add(vars.MAXIMUM_LENGTH_OF_WAIT, 'days').format('DD.MM')
        const from = moment(`${state.leaveStart.day}.${state.leaveStart.month}`, 'D.M').format('DD.MM')
        const to = moment(`${state.leaveEnd.day}.${state.leaveEnd.month}`, 'D.M').format('DD.MM')

        const buttonsMessage = routines.buildMessageWithButtons(
          `Пользователь @${username} хочет в отпуск с ${from} по ${to}. Ответ нужно дать до ${deadline}.`,
          [
            ['Одобрить', `${msg.robot.alias} одобрить заявку @${username}`],
            ['Отклонить', `${msg.robot.alias} отклонить заявку @${username}`]
          ]
        )
        msg.robot.messageRoom(vars.LEAVE_COORDINATION_CHANNEL, buttonsMessage)

        state.requestStatus = vars.PENDING_STATUS
        state.reportToCustomer = false

        msg.send(`Заявка на отпуск отправлена. Ответ поступит не позже чем через ${utils.noname(vars.MAXIMUM_LENGTH_OF_WAIT)}.`)
      } else {
        msg.send('Я прервал процесс формирования заявки на отпуск.')
      }

      this.app.clear()

      state.n = vars.INIT_STATE
    }
  }
}

module.exports = View
