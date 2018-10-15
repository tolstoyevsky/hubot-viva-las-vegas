[![build](https://travis-ci.com/tolstoyevsky/hubot-viva-las-vegas.svg?branch=master)](https://travis-ci.org/tolstoyevsky/hubot-viva-las-vegas)

# hubot-viva-las-vegas

A Hubot script which helps users to create leave requests.

## Prerequisites

* The bot must be in the channel specified via the `LEAVE_COORDINATION_CHANNEL` environment variable.
* The bot has to have `view-full-other-user-info` permission.

## Installation

In hubot project repo, run:

`npm install git+https://github.com/tolstoyevsky/hubot-viva-las-vegas --save`

Then add **hubot-viva-las-vegas** to your `external-scripts.json`:

```json
[
  "hubot-viva-las-vegas"
]
```

## Configuration

The script can be configured via the following environment variables (called parameters).

| Parameter                     | Description | Default |
|-------------------------------|-------------|---------|
| `LEAVE_COORDINATION_CHANNEL`  | The channel name intended for handling users leave requests. The bot **must be** in the channel (see the [Prerequisites](#prerequisites) sections). It's highly recommended to invite HRs, Teach Leads and Team Leads to the channels to make the whole process transparent. | leave-coordination |
| `MAXIMUM_LENGTH_OF_LEAVE`     | The maximum number of days an employee is allowed to be on leave. | 28 |
| `MAXIMUM_LENGTH_OF_WAIT`      | The maximum number of days handling of each request may take. | 7 |
| `MINIMUM_DAYS_BEFORE_REQUEST` | The minimum number of days before the target date an employee is allowed to apply for a leave. | 7 |
| `REMINDER_SCHEDULER`          | Allows specifying the frequency with which the script checks if some of the users are awaiting a reply or back after leave. If the check succeeds, the script sends reminders (either to the channel specified via `LEAVE_COORDINATION_CHANNEL` or directly to users, depending on the particular reminder). The value of this parameter must follow the [Cron Format](https://github.com/node-schedule/node-schedule#cron-style-scheduling). | `0 0 7 * * *` |

## Example Interaction

A user is supposed to send direct messages to the bot, so it's recommended to set `RESPOND_TO_DM` to `true`.

```
some.user >> хочу в отпуск
    hubot >> C какого числа ты хочешь уйти в отпуск? (дд.мм)
some.user >> 26.10
    hubot >> Отлично, по какое? (дд.мм)
some.user >> 27.10
    hubot >> Значит ты планируешь находиться в отпуске 1 день. Все верно? (да/нет)
some.user >> да
    hubot >> Заявка на отпуск отправлена. Ответ поступит не позже чем через 7 дней.
    hubot >> Заявка на отпуск одобрена.
```

## Debug

The following command is
* intended only for debugging purposes, so it's not present in the available Hubot commands list;
* for admin use only.

```
some.user >> hubot reset @user.name 15.10
    hubot >> Готово!
```

In this case the leave end of the user named `user.name` was changed to `15.11` (October 15). It allows simulating returning from leave.


## Authors

See [AUTHORS](AUTHORS.md).

## Licensing

hubot-viva-las-vegas is available under the [Apache License, Version 2.0](LICENSE).
