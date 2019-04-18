const moment = require('moment')
const routines = require('hubot-routines')

const vars = require('./../vars')
const utils = require('./../utils')

const { Stack } = require('./../stack')

async function getCustomerState (robot, customer) {
  customer.vivaLasVegas = customer.vivaLasVegas || {}
  if (customer.vivaLasVegas.allocation) {
    const { vivaLasVegas } = await routines.findUserByName(robot, customer.vivaLasVegas.allocation)
    return vivaLasVegas
  } else {
    return customer.vivaLasVegas
  }
}

module.exports = async (msg) => {
  const adverb = utils.adverbToDate(msg.match[1].toLowerCase(), vars.OUTPUT_DATE_FORMAT)
  const date = adverb || moment(msg.match[2], vars.DATE_FORMAT).format(vars.OUTPUT_DATE_FORMAT)
  const customer = await routines.findUserByName(msg.robot, msg.message.user.name)
  const state = await getCustomerState(msg.robot, customer)

  let day = parseInt(moment(adverb, vars.OUTPUT_DATE_FORMAT).date()) || parseInt(msg.match[3])
  let month = parseInt(moment(adverb, vars.OUTPUT_DATE_FORMAT).month()) + 1 || parseInt(msg.match[4])

  if (!routines.isValidDate(date, vars.DATE_FORMAT)) {
    msg.send(vars.INVALID_DATE_MSG)

    return
  }

  if (customer.timeOff && customer.timeOff.allocation) {
    const candidate = await routines.findUserByName(msg.robot, customer.timeOff.allocation)

    const date = moment(`${day}.${month}`, vars.DATE_FORMAT)
    if (date.isBefore(moment())) {
      date.year(date.year() + 1)
    }

    let messageText = ''

    candidate.timeOff.list = candidate.timeOff.list || []

    if (!candidate.timeOff.list.find(item => !item.type)) {
      const date = moment(`${day}.${month}`, vars.DATE_FORMAT)

      if (date.isBefore(moment().startOf('day'))) {
        date.year(date.year() + 1)
      }

      if (candidate.timeOff.list.find(item => item.date === date.format('DD.MM.YYYY'))) {
        delete customer.timeOff.allocation
        return msg.send(`У пользователя @${candidate.name} уже намечен отгул на ${date.format('DD.MM')}`)
      } else {
        candidate.timeOff.list.push({
          date: date.format('DD.MM.YYYY'),
          type: null
        })
      }
      messageText = `Отлично. Значит @${candidate.name} берет отгул ${date.format('DD.MM')}. `
    } else {
      const user = msg.message.user
      messageText = `Давай по порядку. @${user.timeOff.allocation} берет отгул *${candidate.timeOff.list[0].date}*. `
    }

    messageText += 'Какой это будет отгул?'

    const message = routines.buildMessageWithButtons(
      messageText,
      [
        ['С отработкой', 'С отработкой'],
        ['За свой счет', 'За свой счет'],
        ['В счет отпуска', 'В счет отпуска'],
        ['Отмена', 'Отгул не нужен']
      ]
    )

    msg.send(message)
  } else if (state.n === vars.FROM_STATE) {
    const today = moment().startOf('day')
    // moment().month() starts counting with 0
    const currentMonth = today.month() + 1
    let year

    if (currentMonth === month) {
      if (today.date() > day) {
        year = today.year() + 1
      } else {
        year = today.year()
      }
    } else if (currentMonth > month) {
      year = today.year() + 1
    } else {
      year = today.year()
    }

    if (!customer.vivaLasVegas.allocation) {
      const startDay = moment(`${day}.${month}.${year}`, 'D.M.YYYY')
      const daysBefore = startDay.diff(today, 'days')

      if (daysBefore < vars.MINIMUM_DAYS_BEFORE_REQUEST) {
        const minDate = today.add(vars.MINIMUM_DAYS_BEFORE_REQUEST, 'd').format('DD.MM.YYYY')
        let duration
        switch (daysBefore) {
          case 0:
            duration = 'уже сегодня'
            break
          case 1:
            duration = 'уже завтра'
            break
          default:
            duration = `только через ${utils.noname(daysBefore)}`
            break
        }
        msg.send(`Нужно запрашивать отпуск минимум за ${utils.noname(vars.MINIMUM_DAYS_BEFORE_REQUEST)}, а твой - ${duration}. Попробуй выбрать дату позднее ${minDate}.`)
        return
      }
    }

    const leaveStart = {}

    leaveStart.day = day
    leaveStart.month = month
    leaveStart.year = year

    state.leaveStart = leaveStart
    state.n = vars.TO_STATE

    msg.send(`Отлично, по какое? (${vars.USER_FRIENDLY_DATE_FORMAT})`)
  } else if (state.n === vars.TO_STATE) {
    const appeal = customer.vivaLasVegas.allocation
      ? `@${customer.vivaLasVegas.allocation} планирует`
      : 'ты планируешь'
    const leaveStart = state.leaveStart
    const leaveEnd = {}

    let year = leaveStart.month >= month && leaveStart.day >= day ? leaveStart.year + 1 : leaveStart.year

    const d1 = moment(`${leaveStart.day}.${leaveStart.month}.${leaveStart.year}`, 'D.M.YYYY')
    const d2 = moment(`${day}.${month}.${year}`, 'D.M.YYYY')

    let withWeekends = ''

    if (d2.day() >= 5) {
      d2.day(7)

      day = d2.date()
      month = d2.month() + 1
      year = d2.year()

      withWeekends = ' (учитывая выходные)'
    }

    const daysNumber = d2.diff(d1, 'days') + 1

    if (daysNumber > vars.MAXIMUM_LENGTH_OF_LEAVE) {
      msg.send(`Отпуск продолжительностью ${utils.noname(daysNumber)} выглядит круто (особенно если он оплачиваемый :joy:), но ты можешь претендовать максимум на ${utils.noname(vars.MAXIMUM_LENGTH_OF_LEAVE)}.`)

      return
    }

    leaveEnd.day = day
    leaveEnd.month = month
    leaveEnd.year = year

    state.leaveEnd = leaveEnd
    state.n = vars.CONFIRM_STATE

    const buttonsMessage = routines.buildMessageWithButtons(
      `Значит ${appeal} находиться в отпуске ${utils.noname(daysNumber)}${withWeekends}. Все верно?`,
      [
        ['Да', customer.vivaLasVegas.allocation ? 'Да, планирует' : 'Да, планирую'],
        ['Нет', customer.vivaLasVegas.allocation ? 'Нет, не планирует' : 'Нет, не планирую']
      ]
    )

    msg.send(buttonsMessage)
  } else if (state.n === vars.WAITING_DATE_STATE) {
    const dateOfWorkFromHome = new Stack(state.dateOfWorkFromHome)
    switch (dateOfWorkFromHome.checkDate(date)) {
      case 1:
        msg.send('Не валидная дата.')
        return
      case 2:
        msg.send(`Но ${date} уже прошло :rolling_eyes:. Выбери дату позднее ${moment().add(-1, 'day').format(vars.OUTPUT_DATE_FORMAT)}.`)
        return
      case 3:
        msg.send('Нельзя запланировать день работы из дома больше, чем на две недели вперед.')
        return
      case 4:
        msg.send(`Ты не можешь взять еще один день на этой неделе. Попробуй на следующей.`)
        return
      default:
        dateOfWorkFromHome.push(date)
    }

    state.dateRequested = dateOfWorkFromHome[1]
    state.n = vars.WAITING_CONFIRMATION_STATE
    const buttonsMessage = routines.buildMessageWithButtons(
      'Согласован ли этот день с руководителем/тимлидом?',
      [
        ['Да', 'Да, согласован'],
        ['Нет', 'Нет, не согласован']
      ]
    )
    msg.send(buttonsMessage)
  }
}
