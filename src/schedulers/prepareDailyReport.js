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
        const today = moment().format('DD.MM.YYYY')

        user.vivaLasVegas.dateOfWorkFromHome = user.vivaLasVegas.dateOfWorkFromHome.filter(item => {
          if (typeof item === 'object') {
            return !moment(item.date, vars.CREATION_DATE_FORMAT).isBefore(moment().startOf('day'))
          } else if (typeof item === 'string') {
            return !moment(item, vars.CREATION_DATE_FORMAT).isBefore(moment().startOf('day'))
          }
        })

        return user.vivaLasVegas.dateOfWorkFromHome.find(item => {
          if (typeof item === 'object') {
            return item.date === today
          } else if (typeof item === 'string') {
            return item === today
          }
        })
      }
    })
  let backFromVacation = allUsers
    .filter(user => {
      if (!user.vivaLasVegas || !user.vivaLasVegas.leaveStart) {
        return false
      }
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
      if (utils.isEqualDate(today, leaveEnd)) {
        if (user.vivaLasVegas.requestStatus === vars.APPROVED_STATUS) {
          return true
        } else {
          delete user.vivaLasVegas.leaveStart
        }
      }
    })
  let wentOnVacation = allUsers
    .filter(user => {
      if (!user.vivaLasVegas || !user.vivaLasVegas.leaveStart) {
        return false
      }
      const d = user.vivaLasVegas.leaveStart.day
      const m = user.vivaLasVegas.leaveStart.month
      const y = user.vivaLasVegas.leaveStart.year
      const leaveStart = moment(`${d}.${m}.${y}`, vars.CREATION_DATE_FORMAT)

      const isApproved = user.vivaLasVegas.requestStatus === vars.APPROVED_STATUS
      const isToday = utils.isEqualDate(today, leaveStart)
      return isToday && isApproved
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
