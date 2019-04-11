const moment = require('moment')
const routines = require('hubot-routines')

const vars = require('../../vars')

module.exports = async msg => {
  if (!await routines.isAdmin(msg.robot, msg.message.user.name)) {
    return msg.send(vars.ACCESS_DENIED_MSG)
  }

  const username = msg.match[2]
  const leaveStart = msg.match[3] === '*' ? null : moment(msg.match[3], 'D.M.YYYY')
  const leaveEnd = msg.match[4] === '*' ? null : moment(msg.match[4], 'D.M.YYYY')

  if (![leaveStart, leaveEnd].every(item => item.isValid())) {
    return msg.send(vars.INVALID_DATE_MSG)
  }

  const user = await routines.findUserByName(msg.robot, username)

  if (user) {
    let day, month, year
    const dates = []

    if (leaveStart !== '*') {
      day = leaveStart.date()
      month = leaveStart.month()
      year = leaveStart.year()
      user.vivaLasVegas.leaveStart = { day, month, year }

      dates.leaveStart = moment(`${day}.${month}.${year}`, 'D.M.YYYY').format('DD.MM.YYYY')
    } else {
      const leaveDate = Object.values(user.vivaLasVegas.leaveStart).join('.')
      dates.leaveStart = moment(leaveDate, 'D.M.YYYY').format('DD.MM.YYYY')
    }

    if (leaveEnd !== '*') {
      day = parseInt(leaveEnd.split('.')[0])
      month = parseInt(leaveEnd.split('.')[1])
      year = parseInt(leaveEnd.split('.')[2])
      user.vivaLasVegas.leaveEnd = { day, month, year }
      dates.leaveEnd = moment(`${day}.${month}.${year}`, 'D.M.YYYY').format('DD.MM.YYYY')
    } else {
      const leaveDate = Object.values(user.vivaLasVegas.leaveEnd).join('.')
      dates.leaveEnd = moment(leaveDate, 'D.M.YYYY').format('DD.MM.YYYY')
    }

    user.vivaLasVegas.requestStatus = vars.APPROVED_STATUS
    msg.send(`Даты отпуска успешно перезаписаны!\n@${username} в отпуске с ${dates.leaveStart} по ${dates.leaveEnd}.`)
  } else {
    msg.send('*Ошибка*. Не удалось найти пользователя.')
  }
}
