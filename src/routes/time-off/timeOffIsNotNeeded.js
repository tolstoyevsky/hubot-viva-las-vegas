const routines = require('hubot-routines')

module.exports = async msg => {
  const errorMsg = 'Этот пользователь и не собирался брать отгул.'
  const user = msg.message.user

  if (!user.timeOff || !user.timeOff.allocation) {
    return msg.send(errorMsg)
  }

  const candidate = await routines.findUserByName(
    msg.robot,
    user.timeOff.allocation
  )

  if (!candidate.timeOff.list.find(item => !item.type)) {
    return msg.send(errorMsg)
  }

  // Deleting all nullable type attribute
  candidate.timeOff.list = candidate.timeOff.list.filter(item => {
    return item.type
  })

  delete user.timeOff.allocation
  delete user.vivaLasVegas.n

  msg.send(`Отгул для @${candidate.name} отменен.`)
}
