const moment = require('moment')
const routines = require('hubot-routines')

const vars = require('./../vars')
const utils = require('./../utils')

function sortingByStatus (a, b) {
  if (!a.reportToCustomer && b.reportToCustomer) return -1
  if (a.reportToCustomer && !b.reportToCustomer) return 1
}

function sortingByValue (a, b, format) {
  const firstDate = moment(`${a.leaveStart.day}.${a.leaveStart.month}.${a.leaveStart.year}`, format).format(format)
  const secondDate = moment(`${b.leaveStart.day}.${b.leaveStart.month}.${b.leaveStart.year}`, format).format(format)

  let first = moment(firstDate, format).unix()
  let second = moment(secondDate, format).unix()

  return first - second
}

/**
 * Check if user has warned the customer.
 *
 * @param {Boolean} status - If user has warned the customer or not.
 * @returns {Array}
 */
function isReport (status) {
  return status ? [':white_check_mark:', 'в курсе.'] : [':x:', 'не предупрежден.']
}

/**
 * Send reminders of the upcoming vacation to HR channel.
 *
 * @param {Robot} robot - Hubot instance.
 */
module.exports = async function (robot) {
  const users = await routines.getAllUsers(robot)
  const sortedUsers = users
    .filter(users => users.vivaLasVegas && users.vivaLasVegas.leaveStart && users.vivaLasVegas.requestStatus === vars.APPROVED_STATUS)
    .sort((a, b) => sortingByValue(a.vivaLasVegas, b.vivaLasVegas, 'DD.MM.YYYY'))
    .sort((a, b) => sortingByStatus(a.vivaLasVegas, b.vivaLasVegas))

  const message = []

  for (const user of sortedUsers) {
    if (await routines.isUserActive(robot, user)) {
      const obj = user.vivaLasVegas.leaveStart
      const reportStatus = user.vivaLasVegas.reportToCustomer
      const leaveStart = moment(`${obj.day}.${obj.month}.${obj.year}`, 'D.M.YYYY')
      const amount = leaveStart.diff(moment(), 'days') + 1
      const days = Object.values(arguments).slice(1)
      const currentDay = days.indexOf(parseInt(amount)) >= 0

      if (currentDay) {
        if ((amount === 1 && !reportStatus) || amount !== 1) {
          const emoji = isReport(reportStatus)[0]
          const status = isReport(reportStatus)[1]
          message.push(`${emoji} @${user.name} уходит в отпуск через ${utils.noname(amount)}. Заказчик ${status}`)
        }

        if (!reportStatus) {
          const question = routines.buildMessageWithButtons(
            `Привет, твой отпуск начинается уже через ${utils.noname(amount)}. Заказчик предупрежден?`,
            [
              ['Да', 'Да, предупрежден'],
              ['Нет', 'Нет, не предупрежден']
            ]
          )
          robot.adapter.sendDirect({ user: { name: user.name } }, question)
        }
      }
    }
  }

  if (message.length) {
    robot.messageRoom(vars.LEAVE_COORDINATION_CHANNEL, message.join('\n'))
  }
}
