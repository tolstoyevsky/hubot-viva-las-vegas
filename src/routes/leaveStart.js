const routines = require('hubot-routines')
const moment = require('moment')

const vars = require('./../vars')
const utils = require('./../utils')

module.exports = async function (msg) {
  const username = msg.match[1] ? msg.message.user.name : msg.match[3]
  const user = await routines.findUserByName(msg.robot, username)

  if (!user) return msg.send(vars.UNKNOWN_USER_MSG)

  const state = await utils.getStateFromBrain(msg.robot, username)

  if (msg.match[2]) { // @username хочет в отпуск
    const admin = await routines.findUserByName(msg.robot, msg.message.user.name)
    admin.vivaLasVegas = admin.vivaLasVegas || {}
    admin.vivaLasVegas.allocation = username

    if (!await routines.isAdmin(msg.robot, admin.name)) {
      msg.send(vars.ACCESS_DENIED_MSG)
      return
    }
  }

  if (state.n !== undefined && state.n !== vars.INIT_STATE && state.n < vars.CONFIRM_STATE) {
    const appeal = msg.match[1] ? 'ты хочешь' : `@${username} хочет`
    const leaveStart = state.leaveStart
    const leaveEnd = state.leaveEnd
    let infoMessage

    switch (state.n) {
      case 1: {
        infoMessage = '\n'
        break
      }
      case 2: {
        infoMessage = `\nИтак, ${appeal} в отпуск с ${moment(`${leaveStart.day}.${leaveStart.month}`, vars.DATE_FORMAT).format('DD.MM')}.\n`
        break
      }
      case 3: {
        infoMessage = `\nИтак, ${appeal} уйти в отпуск с ${moment(`${leaveStart.day}.${leaveStart.month}`, vars.DATE_FORMAT).format('DD.MM')} по ${moment(`${leaveEnd.day}.${leaveEnd.month}`, vars.DATE_FORMAT).format('DD.MM')}.\n`
        break
      }
    }

    if (state.n === 3) {
      const message = routines.buildMessageWithButtons(
        `${vars.ANGRY_MSG}${infoMessage}${vars.statesMessages[state.n]}`,
        [
          ['Да', msg.match[1] ? 'Да, планирую' : 'Да, планирует'],
          ['Нет', msg.match[1] ? 'Нет, не планирую' : 'Нет, не планирует']
        ]
      )
      msg.send(message)
    } else {
      const message = vars.statesMessages[state.n].replace('%s', appeal)
      msg.send(`${vars.ANGRY_MSG}${infoMessage}${message}`)
    }

    return
  }

  if (state.requestStatus === vars.APPROVED_STATUS) {
    if (msg.match[2]) { // @username хочет в отпуск
      msg.send('Заявка этого пользователя уже была одобрена.')
    } else {
      msg.send('Твоя предыдущая заявка была одобрена, так что сначала отгуляй этот отпуск.')
    }

    return
  }

  if (state.requestStatus === vars.PENDING_STATUS) {
    if (msg.match[2]) { // @username хочет в отпуск
      msg.send('У этого пользователя уже есть заявка на отпуск.')
    } else {
      msg.send('Твоя заявка на отпуск уже отправлена. Дождись ответа.')
    }

    return
  }

  state.creationDate = moment().format(vars.CREATION_DATE_FORMAT)
  state.n = vars.FROM_STATE

  msg.send(`Ok, с какого числа? (${vars.USER_FRIENDLY_DATE_FORMAT})`)
}
