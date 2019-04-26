const routines = require('hubot-routines')

module.exports = (msg) => {
  const text = 'По какой причине ты будешь отсутствовать?'
  const buttons = [
    ['Болею', 'Болею'],
    ['Буду работать из дома', 'Работаю из дома'],
    ['Хочу оформить отпуск', 'Хочу в отпуск']
  ]

  const message = routines.buildMessageWithButtons(text, buttons)

  msg.send(message)
}
