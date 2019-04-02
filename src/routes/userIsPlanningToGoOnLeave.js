const moment = require('moment')
const routines = require('hubot-routines')

const vars = require('../vars')
const utils = require('../utils')

module.exports = async msg => {
  const answer = msg.match[1].toLowerCase().trim()
  const customer = await routines.findUserByName(msg.robot, msg.message.user.name)

  if (!customer.vivaLasVegas.allocation) {
    msg.send(vars.CONFUSED_MSG)
    return
  }

  const user = await routines.findUserByName(msg.robot, customer.vivaLasVegas.allocation)
  const state = await utils.getStateFromBrain(msg.robot, user.name)

  if (state.n !== vars.CONFIRM_STATE) {
    msg.send(vars.CONFUSED_MSG)
    return
  }

  if (answer === 'да, планирует') {
    const from = moment(`${state.leaveStart.day}.${state.leaveStart.month}`, 'D.M')
    const to = moment(`${state.leaveEnd.day}.${state.leaveEnd.month}`, 'D.M')

    state.requestStatus = vars.APPROVED_STATUS
    state.reportToCustomer = false

    const googleEvent = vars.GOOGLE_API ? 'Событие добавлено в календарь.' : ''

    if (vars.GOOGLE_API) {
      const startDay = from.format('YYYY-MM-DD')
      const endDay = to.add(1, 'day').format('YYYY-MM-DD')

      utils.addEventToCalendar(msg.robot, startDay, endDay, user, vars.GOOGLE_EVENT_VACATION)
        .then(eventId => { state.eventId = eventId })
    }

    const message = `Пользователем @${customer.name} только что создана заявка на отпуск @${user.name} c ${from.format('DD.MM')} по ${to.format('DD.MM')}.`
    msg.robot.messageRoom(vars.LEAVE_COORDINATION_CHANNEL, message)
    msg.send(`Заявка на отпуск для пользователя @${user.name} создана и одобрена. ${googleEvent}`)
    const question = routines.buildMessageWithButtons(
      `Привет, тебе оформлен отпуск с ${from.format('DD.MM')} по ${to.format('DD.MM')}. Заказчик предупрежден?`,
      [
        ['Да', 'Да, предупрежден'],
        ['Нет', 'Нет, не предупрежден']
      ]
    )
    msg.robot.adapter.sendDirect({ user: { name: user.name } }, question)
  } else if (answer === 'нет, не планирует') {
    msg.send('Я прервал процесс формирования заявки на отпуск.')
  }

  delete state.n
  delete customer.vivaLasVegas.allocation
}
