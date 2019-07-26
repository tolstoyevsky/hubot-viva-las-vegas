const moment = require('moment')
const routines = require('hubot-routines')

const vars = require('../../vars')
const { AbstractView } = require('hubot-engine')
const { REQUESTS_LIST_PERMISSION } = require('../../vars')

class View extends AbstractView {
  init (options) {
    options.app = 'leave'
    options.permissions = [REQUESTS_LIST_PERMISSION]
  }

  async callback (msg) {
    const users = await routines.getAllUsers(msg.robot)

    const formatLine = user => {
      const username = user.name
      const from = user.vivaLasVegas.leaveStart
      const to = user.vivaLasVegas.leaveEnd

      const formattedDate =
        moment(`${from.day}.${from.month}.${from.year}`, 'D.M.YYYY').format('DD.MM.YYYY') +
        ' - ' +
        moment(`${to.day}.${to.month}.${to.year}`, 'D.M.YYYY').format('DD.MM.YYYY')

      return ` @${username} ${formattedDate}`
    }

    const sorting = (a, b, format) => {
      const first = moment(a, format)
      const second = moment(b, format)

      return first.unix() - second.unix()
    }

    const approved = users
      .filter(user => user.vivaLasVegas && user.vivaLasVegas.requestStatus === vars.APPROVED_STATUS)
      .sort((a, b) => sorting(a.vivaLasVegas.leaveStart, b.vivaLasVegas.leaveStart, ''))
      .map(formatLine)
      .join('\n')
    const pending = users
      .filter(user => user.vivaLasVegas && user.vivaLasVegas.requestStatus === vars.PENDING_STATUS)
      .sort((a, b) => sorting(a.vivaLasVegas.leaveStart, b.vivaLasVegas.leaveStart, ''))
      .map(formatLine)
      .join('\n')

    const result = []

    if (approved) result.push(`*Одобренные заявки:*\n ${approved}`)
    if (pending) result.push(`*Ожидающие подтверждения:*\n ${pending}`)
    if (!result.length) result.push('Никто не собирается в отпуск.')

    msg.send(result.join('\n'))
  }
}

module.exports = View
