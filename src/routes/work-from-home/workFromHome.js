const { Stack } = require('../../stack')

const vars = require('../../vars')
const utils = require('../../utils')

module.exports = async function (msg) {
  const state = await utils.getStateFromBrain(msg.robot, msg.message.user.name)

  let dayOfWorkFromHome = new Stack(state.dateOfWorkFromHome)
  if (!dayOfWorkFromHome.canWork()) {
    msg.send(`Ты уже работаешь из дома ${dayOfWorkFromHome[1]}. Если хочешь все отменить, скажи 'не работаю из дома' :wink:.`)
    return
  }

  state.n = vars.WAITING_DATE_STATE
  msg.send(`Ok, в какой день? (сегодня/завтра/${vars.USER_FRIENDLY_DATE_FORMAT})`)
}
