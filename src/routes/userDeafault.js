const routines = require('hubot-routines')

const vars = require('../vars')

module.exports = async (msg) => {
  const user = await routines.findUserByName(msg.robot, msg.match[1])

  if (!await routines.isAdmin(msg.robot, msg.message.user.name)) {
    return msg.send(vars.ACCESS_DENIED_MSG)
  }

  if (!user) {
    return msg.send(vars.UNKNOWN_USER_MSG)
  }

  const { vivaLasVegas } = user
  if (vivaLasVegas) {
    if (vivaLasVegas.n) { // Is exists and not 0
      delete vivaLasVegas.n
    }
    if (vivaLasVegas.allocation) {
      delete vivaLasVegas.allocation
    }
    if (vivaLasVegas.dateRequested) {
      delete vivaLasVegas.dateRequested
    }
  }
  const { timeOff } = user
  if (timeOff) {
    delete timeOff.allocation
    timeOff.list = timeOff.list.filter(item => item.type)
  }

  msg.send('Состояние пользователя очищено')
}
