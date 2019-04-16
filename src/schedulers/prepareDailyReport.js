const moment = require('moment')
const routines = require('hubot-routines')

const vars = require('./../vars')
const utils = require('./../utils')

/*
  * Send to the general channel information about the status of users.
  *
  * @param {Robot} robot - Robot instance.
  */
module.exports = async (robot) => {
  const allUsers = await routines.getAllUsers(robot)
  const informer = {}
  const today = moment()
  if ([6, 0].includes(today.day())) return
  let workFromHome = allUsers
    .filter(user => {
      if (user.vivaLasVegas && user.vivaLasVegas.dateOfWorkFromHome) {
        const date = moment(user.vivaLasVegas.dateOfWorkFromHome[1], vars.CREATION_DATE_FORMAT)

        return utils.isEqualDate(today, date)
      }
    })
  let backFromVacation = allUsers
    .filter(user => {
      if (user.vivaLasVegas && user.vivaLasVegas.leaveStart) {
        // It sometimes happened that leaveEnd is undefined.
        if (!user.vivaLasVegas.leaveEnd) {
          robot.logger.error(`In backFromVacation leaveEnd attribute of @${user.name} is missing.`)
          robot.logger.error(JSON.stringify(user))
          return false
        }
        const d = user.vivaLasVegas.leaveEnd.day
        const m = user.vivaLasVegas.leaveEnd.month
        const y = user.vivaLasVegas.leaveEnd.year
        const leaveEnd = moment(`${d}.${m}.${y}`, vars.CREATION_DATE_FORMAT).add(1, 'days')
        return utils.isEqualDate(today, leaveEnd)
      }
    })
  let wentOnVacation = allUsers
    .filter(user => {
      if (user.vivaLasVegas && user.vivaLasVegas.leaveStart) {
        const d = user.vivaLasVegas.leaveStart.day
        const m = user.vivaLasVegas.leaveStart.month
        const y = user.vivaLasVegas.leaveStart.year
        const leaveStart = moment(`${d}.${m}.${y}`, vars.CREATION_DATE_FORMAT)

        return utils.isEqualDate(today, leaveStart)
      }
    })
  let sickPeople = allUsers.filter(user => user.sick && !user.sick.isWork)
  let sickPeopleWorkHome = allUsers.filter(user => user.sick && user.sick.isWork)
  let timeOffPeople = allUsers.filter(user => {
    if (user.timeOff && user.timeOff.list) {
      const today = moment().format('DD.MM.YYYY')
      const result = user.timeOff.list.find(item => item.date === today)
      user.timeOff.list = user.timeOff.list.filter(item => item.date !== today)
      return result
    }
  })

  informer[`Из дома работа${workFromHome.length > 1 ? 'ют' : 'ет'}`] = workFromHome
  informer[`${wentOnVacation.length > 1 ? 'Ушли' : 'Пользователь ушел'} в отпуск`] = wentOnVacation
  informer[`${backFromVacation.length > 1 ? 'Вернулись' : 'Пользователь вернулся'} из отпуска`] = backFromVacation
  informer[`Боле${sickPeople.length > 1 ? 'ют' : 'ет'}`] = sickPeople
  informer[`Боле${sickPeopleWorkHome.length > 1 ? 'ют' : 'ет'} (работа из дома)`] = sickPeopleWorkHome
  informer[`${timeOffPeople.length > 1 ? 'Взяли' : 'Пользователь взял'} отгул`] = timeOffPeople
  // Form mesage
  const message = []
  for (const key in informer) {
    const value = informer[key]

    if (value && value.length) {
      message.push(`${key}: ${value.map(user => `${value.length > 1 ? '\n' : ''}@${user.name}`).join('')}`)
    }
  }
  if (message.length) {
    const today = `*Сегодня:*\n`
    robot.messageRoom('general', today + message.join('\n'))
  }
}
