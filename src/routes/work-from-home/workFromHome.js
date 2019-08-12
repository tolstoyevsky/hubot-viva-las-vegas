const vars = require('../../vars')
const utils = require('../../utils')
const { AbstractView } = require('hubot-engine')

class View extends AbstractView {
  init (options) {
    options.app = 'workFromHome'
  }

  async callback (msg) {
    const state = await utils.getStateFromBrain(msg.robot, msg.message.user.name)

    this.app.set()

    state.n = vars.WAITING_DATE_STATE
    msg.send(`Ok, в какой день? (сегодня/завтра/${vars.USER_FRIENDLY_DATE_FORMAT})`)
  }
}

module.exports = View
