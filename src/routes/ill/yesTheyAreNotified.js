const moment = require('moment')

const vars = require('../../vars')
const utils = require('../../utils')

module.exports = async msg => {
  const user = msg.message.user
  const today = moment()
  const tomorrow = moment().add(1, 'days')

  if (user.sick) return
  if (!(typeof user.sickConfirming === 'string')) return

  if (msg.match[1].toLowerCase() === 'да, они предупреждены, что я болею') {
    const isWork = user.sickConfirming === 'болею и работаю'

    if (!user.sick) {
      user.sick = Object()
    }

    let isCalendar = vars.GOOGLE_API ? ' Я добавил событие в календарь.' : ''
    if (vars.GOOGLE_API) {
      utils.addEventToCalendar(
        msg.robot,
        today.format('YYYY-MM-DD'),
        tomorrow.format('YYYY-MM-DD'),
        user,
        isWork ? vars.GOOGLE_EVENT_SICK_WITH_WORK : vars.GOOGLE_EVENT_SICK
      ).then(eventId => { user.sick.eventId = eventId })
    }

    user.sick.start = today.format(vars.CREATION_DATE_FORMAT)
    user.sick.isWork = isWork
    delete user.sickConfirming

    msg.robot.messageRoom(
      vars.LEAVE_COORDINATION_CHANNEL,
      `@${user.name} болеет и ${isWork ? 'работает' : 'не может работать'} из дома`
    )

    msg.send(`Ok. Выздоравливай поскорее.${isCalendar} Когда ты выйдешь на работу, скажи мне \`я не болею\`.`)
  } else {
    delete user.sickConfirming
    msg.send('Тогда сначала предупреди, а потом вернись и повтори все снова!')
  }
}
