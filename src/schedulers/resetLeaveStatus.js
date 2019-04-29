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
  const today = moment().startOf('day')
  const users = await routines.getAllUsers(robot)

  for (const user of users) {
    const state = await utils.getStateFromBrain(robot, user.name)

    if (state.requestStatus === vars.PENDING_STATUS) {
      const { day, month, year } = state.leaveStart
      const leaveStart = moment(`${day}.${month}.${year}`, vars.CREATION_DATE_FORMAT)
      const waitingApproveDate = moment(state.creationDate, vars.CREATION_DATE_FORMAT)
        .add(vars.MAXIMUM_LENGTH_OF_WAIT, 'days')

      if (today.isSame(waitingApproveDate, 'day')) {
        utils.cleanupState(state)
        delete state.creationDate

        robot.adapter.sendDirect(
          { user: { name: user.name } },
          `Твоя заявка на отпуск с ${leaveStart.format('DD.MM')} была удалена, так как до сих пор не была рассмотрена. Если ты все еще хочешь в отпуск, отправь новую заявку.`
        )
        robot.messageRoom(
          vars.LEAVE_COORDINATION_CHANNEL,
          `Заявка на отпуск @${user.name} с ${leaveStart.format('DD.MM')} осталась без внимания, срок ее ожидания прошел и она была удалена.`
        )
      }
    }

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
