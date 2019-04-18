const routines = require('hubot-routines')

const vars = require('../../vars')

module.exports = async msg => {
  const user = msg.message.user
  const username = msg.match[2]
  const candidate = await routines.findUserByName(msg.robot, username)

  if (!await routines.isAdmin(msg.robot, user.name)) return msg.send(vars.ACCESS_DENIED_MSG)

  if (!candidate) return msg.send(vars.UNKNOWN_USER_MSG)

  if (user.timeOff && user.timeOff.allocation) {
    const correctUser = await routines.findUserByName(msg.robot, user.timeOff.allocation)
    if (!correctUser.timeOff.list || !correctUser.timeOff.list.find(user => !user.type)) {
      return msg.send(
        `Дaвай по порядку. Какого числа @${correctUser.name} хочет взять отгул?`
      )
    } else {
      const date = correctUser.timeOff.list.find(item => !item.type).date
      return msg.send(routines.buildMessageWithButtons(
        `Дaвай по порядку. Какой отгул хочет взять @${correctUser.name} ${date}?`,
        [
          ['С отработкой', 'С отработкой'],
          ['За свой счет', 'За свой счет'],
          ['В счет отпуска', 'В счет отпуска'],
          ['Отмена', 'Отгул не нужен']
        ]
      ))
    }
  }

  candidate.timeOff = candidate.timeOff || {}
  user.timeOff = user.timeOff || {}

  user.timeOff.allocation = username

  msg.send(`Когда @${candidate.name} хочет взять отгул?`)
}
