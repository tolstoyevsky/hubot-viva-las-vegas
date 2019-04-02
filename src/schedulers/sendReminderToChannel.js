const moment = require('moment')
const routines = require('hubot-routines')

const vars = require('./../vars')
const utils = require('./../utils')

module.exports = async (robot) => {
  const allUsers = await routines.getAllUsers(robot)

  for (const user of allUsers) {
    const state = await utils.getStateFromBrain(robot, user.name)

    if (!state) continue

    if (state.requestStatus === vars.PENDING_STATUS) {
      const deadline = moment(state.creationDate, vars.CREATION_DATE_FORMAT).add(vars.MAXIMUM_LENGTH_OF_WAIT, 'days').format('DD.MM')

      robot.messageRoom(vars.LEAVE_COORDINATION_CHANNEL, `Нужно дать ответ @${user.name} до ${deadline}.`)
    }
  }
}
