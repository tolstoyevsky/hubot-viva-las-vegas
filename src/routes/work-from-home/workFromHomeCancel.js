const routines = require('hubot-routines')

const vars = require('../../vars')
const utils = require('../../utils')

const { Stack } = require('../../stack')

module.exports = async (msg) => {
  const state = await utils.getStateFromBrain(msg.robot, msg.message.user.name)
  const user = await routines.findUserByName(msg.robot, msg.message.user.name)

  let dayOfWorkFromHome = new Stack(state.dateOfWorkFromHome)
  if (!dayOfWorkFromHome.canWork()) {
    dayOfWorkFromHome.rollback()
    state.dateOfWorkFromHome = dayOfWorkFromHome
    state.dateRequested = null
    if (vars.GOOGLE_API && user.vivaLasVegas.homeWorkEventId) {
      utils.deleteEventFromCalendar(msg.robot, user.vivaLasVegas.homeWorkEventId)
    }
    if (user.vivaLasVegas.homeWorkEventId) {
      msg.send('Я тебя понял. :ok_hand: Убираю событие из календаря.')
    } else {
      msg.send('Я тебя понял. :ok_hand:')
    }
    delete user.vivaLasVegas.homeWorkEventId
  } else {
    msg.send('У тебя не запланирован день работы из дома, который можно было бы отменить, а прошлого не вернешь...')
  }
}
