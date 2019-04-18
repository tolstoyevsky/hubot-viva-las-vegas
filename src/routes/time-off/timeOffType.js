const moment = require('moment')
const routines = require('hubot-routines')

const vars = require('../../vars')
const utils = require('../../utils')

module.exports = async msg => {
  const errorMsg = 'Я не знал, что пользователь собирался брать отгул. Если хочешь сообщить об отгуле, скажи @username хочет отгул.'
  const user = msg.message.user

  if (!user.timeOff || !user.timeOff.allocation) {
    return msg.send(errorMsg)
  }

  const candidate = await routines.findUserByName(msg.robot, user.timeOff.allocation)

  if (!candidate) {
    return msg.send(errorMsg)
  }

  candidate.timeOff = candidate.timeOff || {}
  candidate.timeOff.list = candidate.timeOff.list || []

  if (!candidate.timeOff.list.find(item => !item.type)) {
    return msg.send(errorMsg)
  }

  const start = moment(candidate.timeOff.list.find(item => !item.type))
    .format('YYYY-MM-DD')

  const end = moment(start, 'YYYY-MM-DD')
    .add(1, 'day')
    .format('YYYY-MM-DD')

  const timeOffType = (msg.match[1] || msg.match[2] || msg.match[3]).toLowerCase()
  const description = `Отгул ${timeOffType}`
  const date = candidate.timeOff.list.find(item => !item.type).date

  if (vars.GOOGLE_API) {
    utils.addEventToCalendar(
      msg.robot,
      start,
      end,
      candidate,
      'Отгул',
      description
    )
  }

  candidate.timeOff.list.find(item => !item.type).type = timeOffType
  delete user.timeOff.allocation

  msg.send(`Отлично. Значит @${candidate.name} берет отгул ${timeOffType} ${date}.`)
  msg.robot.messageRoom(vars.LEAVE_COORDINATION_CHANNEL, `Пользователем @${user.name} только что оформлен отгул ${timeOffType} для @${candidate.name} на ${date}.`)
}
