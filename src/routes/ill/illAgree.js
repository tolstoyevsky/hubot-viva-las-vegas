const routines = require('hubot-routines')

module.exports = msg => {
  const user = msg.message.user

  if (user.sick) return
  if (!(typeof user.sickConfirming === 'boolean')) return

  user.sickConfirming = msg.match[1].toLowerCase()

  const message = routines.buildMessageWithButtons(
    'Я понял. Согласовано ли отсутствие с руководителем/тимлидом?',
    [
      ['Да', 'Да, они предупреждены, что я болею'],
      ['Нет', 'Нет, они не предупреждены, что я болею']
    ]
  )

  msg.send(message)
}
