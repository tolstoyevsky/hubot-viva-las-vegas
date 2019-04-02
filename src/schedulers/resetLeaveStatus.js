const moment = require('moment')

const routines = require('hubot-routines')

const vars = require('./../vars')
const utils = require('./../utils')

/**
 * Reset the leave status of the users if their vacation is over.
 *
 * @param {Robot} robot - Hubot instance.
 * @returns {Void}
 */
module.exports = async (robot) => {
  const users = await routines.getAllUsers(robot)

  for (const user of users) {
    const state = await utils.getStateFromBrain(robot, user.name)

    if (state.requestStatus === vars.APPROVED_STATUS) {
      const yesterday = moment().add(-1, 'day')
      const userEndVacation = moment(`${state.leaveEnd.day}.${state.leaveEnd.month}.${state.leaveEnd.year}`, vars.CREATION_DATE_FORMAT)

      if (utils.isEqualDate(yesterday, userEndVacation)) {
        utils.cleanupState(state)

        robot.adapter.sendDirect({ user: { name: user.name } }, 'С возвращением из отпуска!')
      }
    }
  }
}
