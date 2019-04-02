const routines = require('hubot-routines')

module.exports = async msg => {
  const user = msg.message.user

  // if already sick
  if (user.sick) {
    msg.send('Я уже слышал, что ты болеешь. :thinking:')

    return
  }

  const message = routines.buildMessageWithButtons(
    'Очень жаль. Ты в состоянии работать из дома в эти дни?',
    [
      ['Да', 'Болею и работаю'],
      ['Нет', 'Болею и не работаю']
    ]
  )

  user.sickConfirming = true

  msg.send(message)
}
