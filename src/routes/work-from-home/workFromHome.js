const vars = require('../../vars')
const utils = require('../../utils')
const { AbstractView } = require('hubot-engine')
const { WORK_FROM_HOME_PERMISSION } = require('../../vars')

class View extends AbstractView {
  init (options) {
    options.app = 'workFromHome'
    options.permissions = [WORK_FROM_HOME_PERMISSION]
  }

  async callback (msg) {
    const state = await utils.getStateFromBrain(msg.robot, msg.message.user.name)

    this.app.set()

    state.n = vars.WAITING_DATE_STATE
    msg.send(`Ok, в какой день? (сегодня/завтра/${vars.USER_FRIENDLY_DATE_FORMAT})`)
  }
}

module.exports = View
