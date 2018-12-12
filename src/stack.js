
const moment = require('moment')

const DATE_FORMAT = 'DD.MM.YYYY'
const DATE_FORMAT_SHORT = 'DD.MM'
const DEFAULT_DATE = moment(0).format(DATE_FORMAT_SHORT)

class Stack extends Array {
  constructor (elements) {
    if (elements) {
      if (elements instanceof Array && elements.length === 2) {
        super(...elements)
      } else {
        throw Error('Incorrect date format.')
      }
    } else {
      super(DEFAULT_DATE, DEFAULT_DATE)
    }
  }

  /**
   * Checks if the first date is in the future.
   */
  canWork () {
    let day = moment().format(DATE_FORMAT)
    return moment(this[1], DATE_FORMAT).unix() < moment(day, DATE_FORMAT).unix()
  }

  /**
   * Applies different checks to the specified date.
   * Return codes:
   * * 0 - OK
   * * 1 - The specified date is invalid
   * * 2 - The specified date is in the past
   * * 3 - It's more than two weeks from the specified date
   * * 4 - The specified date is the current week
   *
   * @param {String} date - Date in 'DD.MM' format.
   * @returns {Number}
   */
  checkDate (date) {
    const day = moment().format(DATE_FORMAT_SHORT)
    const today = moment(day, DATE_FORMAT_SHORT)
    const d = moment(this.updateYear(date), DATE_FORMAT)

    if (!d.isValid()) {
      return 1
    }

    if (today.unix() > d.unix()) {
      return 2
    }

    const thisWeek = moment().week()
    const secondWeek = moment().week(thisWeek + 1).week()
    const weekTwoYear = d.year() !== moment().year()
    if (d.week() + d.week() * weekTwoYear !== thisWeek && d.week() + d.week() * weekTwoYear !== secondWeek) {
      return 3
    }

    for (const date of this) {
      if (moment(date, DATE_FORMAT).week() === d.week()) {
        return 4
      }
    }

    return 0
  }

  /**
   * Removes the zero index and pushes the specified element.
   *
   * @param {String} el - Element to be pushed.
   */
  push (...el) {
    let result
    this.shift()
    result = el.map(arg => this.updateYear(arg))
    super.push(...result)
  }

  /**
   * Rolls back the 1st date.
   * After rolling back it becomes equal to the zero index (i.e. the past).
   */
  rollback () {
    this[1] = this[0]
  }

  /**
   * Upgrades the year in the specified date which consists of a day and a
   * month. By default, the missing year in the date is the current year.
   * However, after upgrading the year may become the next one.
   *
   * @param {String} date - Date string.
   * @param {String} date - Date to be upgraded.
   */
  updateYear (date) {
    const d = moment(date, DATE_FORMAT_SHORT)
    const today = moment(moment().format(DATE_FORMAT), DATE_FORMAT)
    if (today.unix() > d.unix()) {
      d.year(d.year() + 1)
    }
    return d.format(DATE_FORMAT)
  }
}

exports.Stack = Stack
