const routines = require('hubot-routines')

const { AbstractView } = require('hubot-engine')

class View extends AbstractView {
  init (options) {
    options.app = 'ill'
  }

  callback (msg) {
    const user = msg.message.user

    // if already ill
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

    this.app.set()

    msg.send(message)
  }
}

module.exports = View
