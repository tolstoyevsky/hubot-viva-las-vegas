const { AbstractView } = require('hubot-engine')
const { WORK_FROM_HOME_PERMISSION } = require('../../vars')

class View extends AbstractView {
  init (options) {
    options.app = 'workFromHome'
    options.permissions = [WORK_FROM_HOME_PERMISSION]
  }

  callback (msg) {
    const choices = [
      'Правда жизни такова - чем больше хочешь что-то изменить, тем больше всё остаётся на своих местах…',
      'Чем старше становится человек, тем больше он противится переменам, особенно переменам к лучшему.',
      'Не откладывайте на завтра то, что можно сделать сегодня.',
      'Не будь болваном. Никогда не откладывай на завтра то, что можешь сделать послезавтра.',
      'Свободен лишь тот, кто владеет собой.',
      'Твоя ответственность безмерна — ты свободен.'
    ]
    msg.send(msg.random(choices))
    this.app.clear()
  }
}

module.exports = View
