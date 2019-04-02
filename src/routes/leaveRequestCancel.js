const routines = require('hubot-routines')

const vars = require('../vars')
const utils = require('../utils')

module.exports = async (msg) => {
  if (!await routines.isAdmin(msg.robot, msg.message.user.name)) {
    return msg.send(vars.ACCESS_DENIED_MSG)
  }

  const username = msg.match[2].trim()
  const state = await utils.getStateFromBrain(msg.robot, username)

  if (state.requestStatus === vars.APPROVED_STATUS) {
    utils.cleanupState(state)

    if (msg.message.room !== vars.LEAVE_COORDINATION_CHANNEL) {
      msg.robot.messageRoom(vars.LEAVE_COORDINATION_CHANNEL, `Пользователь @${msg.message.user.name} отменил заявку на отпуск пользователя @${username}.`)
    }

    if (vars.GOOGLE_API && state.eventId) {
      utils.deleteEventFromCalendar(msg.robot, state.eventId)
      delete state.eventId
    }

    msg.robot.adapter.sendDirect({ user: { name: username } }, `Упс, пользователь @${msg.message.user.name} только что отменил твою заявку на отпуск.`)
    msg.send(`Отпуск пользователя @${username} отменен.`)
  } else if (state.requestStatus === vars.PENDING_STATUS) {
    msg.send('Отменить можно только одобренные заявки. Используй команду \'отклонить\'.')
  } else {
    msg.send('Этот человек не собирается в отпуск.')
  }
}
