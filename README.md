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
| `GOOGLE_API`                  | Specifies whether to create events in Google Calendar using Google API. It can be useful when it's necessary to reflect the employees leave in the calendar. | false |
| `GOOGLE_CALENDAR_NAME`        | Google Calendar name related to the [Service account](https://cloud.google.com/iam/docs/service-accounts). | WIS Calendar |
| `GOOGLE_CLIENT_EMAIL`         | The value of the `client_email` attribute located in the file [created by GCP Console](https://cloud.google.com/iam/docs/creating-managing-service-account-keys) (see the [Integration with Google Calendar](#integration-with-google-calendar) for details). The parameter is **mandatory** if `GOOGLE_API` is set to `true`. | |
| `GOOGLE_PRIVATE_KEY`          | The value of the `private_key` attribute located in the file [created by GCP Console](https://cloud.google.com/iam/docs/creating-managing-service-account-keys) (see the [Integration with Google Calendar](#integration-with-google-calendar) for details). The parameter is **mandatory** if `GOOGLE_API` is set to `true`. | |
| `LEAVE_COORDINATION_CHANNEL`  | The channel name intended for handling users leave requests. The bot **must be** in the channel (see the [Prerequisites](#prerequisites) sections). It's highly recommended to invite HRs, Teach Leads and Team Leads to the channels to make the whole process transparent. | leave-coordination |
| `MAXIMUM_LENGTH_OF_LEAVE`     | The maximum number of days an employee is allowed to be on leave. | 28 |
| `MAXIMUM_LENGTH_OF_WAIT`      | The maximum number of days handling of each request may take. | 7 |
| `MINIMUM_DAYS_BEFORE_REQUEST` | The minimum number of days before the target date an employee is allowed to apply for a leave. | 7 |
| `VIVA_REMINDER_SCHEDULER` | Allows specifying the frequency with which the script checks if some of the users are awaiting a reply or back after leave. If the check succeeds, the script sends reminders (either to the channel specified via `LEAVE_COORDINATION_CHANNEL` or directly to users, depending on the particular reminder). The value of this parameter must follow the [Cron Format](https://github.com/node-schedule/node-schedule#cron-style-scheduling). | `0 0 7 * * *` |

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
some.user >> hubot viva reset @user.name 15.10.2015 25.10.2015
    hubot >> Даты отпуска успешно перезаписаны!
             @user.name в отпуске с 15.10.2015 по 25.10.2015.
```

In this case the leave start of the user named `user.name` was changed to `15.10.2015` (October 15 2015) and the leave end was changed to `25.10.2015` (October 25 2015). It is not mandatory to set both dates, if you replace one of them by `*` it will stay unchanged. It allows simulating returning and starting vacation.

## Integration with Google Calendar

First, create a Google account or use an existing one. Next, visit [Google Cloud Console](https://console.cloud.google.com) and create a project there. Then, go to APIs & Services and enable Google Calendar API. After that, go to the [Credentials](https://console.cloud.google.com/apis/credentials) section and create a Service account key – a `.json` file will be returned as a result. Finally, find the `client_email` field in the file and give the contact specified in the field the permissions to edit the calendar specified via the `GOOGLE_CALENDAR_NAME` parameter.

## Authors

See [AUTHORS](AUTHORS.md).

## Licensing

hubot-viva-las-vegas is available under the [Apache License, Version 2.0](LICENSE).
