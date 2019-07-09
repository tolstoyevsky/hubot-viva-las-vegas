const routines = require('hubot-routines')

const { AbstractView } = require('hubot-engine')
const { SET_UNSET_STATUS_OF_BEING_ILL_PERMISSION } = require('../../vars')

class View extends AbstractView {
  init (options) {
    options.app = 'ill'
    options.permissions = [SET_UNSET_STATUS_OF_BEING_ILL_PERMISSION]
  }

  callback (msg) {
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
}

module.exports = View
