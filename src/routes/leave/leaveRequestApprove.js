const moment = require('moment')
const routines = require('hubot-routines')

const vars = require('../../vars')
const utils = require('../../utils')

module.exports = async (msg) => {
  const action = msg.match[1]
  const username = msg.match[2].trim()

  if (!await routines.isAdmin(msg.robot, msg.message.user.name)) {
    return msg.send(vars.ACCESS_DENIED_MSG)
  }

  const state = await utils.getStateFromBrain(msg.robot, username)
  const user = await routines.findUserByName(msg.robot, username)

  if (!user) {
    return msg.send(vars.UNKNOWN_USER_MSG)
  }

  if (state.requestStatus !== vars.PENDING_STATUS) {
    return msg.send('У этого пользователя нет ожидающей ответа заявки.')
  }

  if (action === 'одобрить') {
    state.requestStatus = vars.APPROVED_STATUS

    const start = state.leaveStart
    const leaveStart = moment(
      `${start.day}.${start.month}.${start.year}`,
      'DD.MM.YYYY'
    ).format('YYYY-MM-DD')

    const end = state.leaveEnd
    const leaveEnd = moment(
      `${end.day}.${end.month}.${end.year}`,
      'DD.MM.YYYY'
    ).add(1, 'day').format('YYYY-MM-DD')

    if (vars.GOOGLE_API) {
      utils.addEventToCalendar(msg.robot, leaveStart, leaveEnd, user, vars.GOOGLE_EVENT_VACATION)
        .then(eventId => { state.eventId = eventId })
    }
  } else {
    utils.cleanupState(state)
  }

  const result = action === 'одобрить' ? 'одобрена' : 'отклонена'

  if (msg.message.room !== vars.LEAVE_COORDINATION_CHANNEL) {
    const admin = msg.message.user.name
    msg.robot.messageRoom(vars.LEAVE_COORDINATION_CHANNEL, `Заявка на отпуск пользователя @${username} была ${result} пользователем @${admin}.`)
  }

  msg.send(`Заявка @${username} ${result}. Я отправлю этому пользователю уведомление об этом.`)

  msg.robot.adapter.sendDirect({ user: { name: username } }, `Заявка на отпуск ${result}.`)
}
