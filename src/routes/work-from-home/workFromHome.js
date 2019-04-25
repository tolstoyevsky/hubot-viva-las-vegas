const vars = require('../../vars')
const utils = require('../../utils')

module.exports = async function (msg) {
  const state = await utils.getStateFromBrain(msg.robot, msg.message.user.name)

  state.n = vars.WAITING_DATE_STATE
  msg.send(`Ok, в какой день? (сегодня/завтра/${vars.USER_FRIENDLY_DATE_FORMAT})`)
}
