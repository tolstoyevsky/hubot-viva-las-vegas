[![build](https://travis-ci.com/tolstoyevsky/hubot-viva-las-vegas.svg?branch=master)](https://travis-ci.org/tolstoyevsky/hubot-viva-las-vegas)

# hubot-viva-las-vegas

A Hubot script which helps users to initiate leave requests, time off requests and set/unset their status of being ill.

## Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Example Interaction](#example-interaction)
- [Debug](#debug)
  * [Update vacation dates](#update-vacation-dates)
  * [Reset user state](#reset-user-state)
- [Integration with Google Calendar](#integration-with-google-calendar)
- [Authors](#authors)
- [Licensing](#licensing)

## Features

- Leave requests
  * Allows initiating a leave request with the maximum length specified via `MAXIMUM_LENGTH_OF_LEAVE` and the minimum amount of days before the request specified via `MINIMUM_DAYS_BEFORE_REQUEST`. Also, the bot automatically adds weekends to the leave length if the last day of the leave falls on a Friday.
    + Each user can initiate only one leave request at a time.
    + The bot sends the information with the details of the requests to the channel specified via `LEAVE_COORDINATION_CHANNEL`.
  * Provides the admins with the centralized approach of approving, rejecting and canceling approved requests in the timeline specified via `MAXIMUM_LENGTH_OF_WAIT`.
    + The admins can see the list of the leave requests sorted by their status (pending or approved).
    + The bot sends daily reminders about requests with the pending status and automatically rejects the expired requests. When it happens, the script informs the user via DM and also all the users in the channel specified via `LEAVE_COORDINATION_CHANNEL`. In this case, the user can initiate one more leave request.
    + If the request was approved, the bot checks 30, 14 and 1 days in advance if the user warned the customer about their absence; the results of the checks are passed to the channel, specified via `LEAVE_COORDINATION_CHANNEL`.
    + If the integration with Google Calendar is enabled, the events will be reflected in the calendar.
    + On the first day after the leave, the bot welcomes the user and make it possible to initiate another leave request.
  * Allows the admins to initiate leave request on behalf of users, ignoring the restriction `MAXIMUM_LENGTH_OF_LEAVE` (see above).
- Work from home (WFH) requests
  * Allows users to send WHF request.
  * If the integration with Google Calendar is enabled, the events will be reflected in the calendar.

- Setting/unsetting status of being ill
  * Each user can set the status of being ill and specify whether they are able to work from home or not.
  * All the users in the channel, specified via `LEAVE_COORDINATION_CHANNEL`, will receive the message that the status of this or that user is marked as being ill; the bot will be naming the users with the status in the daily reports (see below) until the users tell the bot that they unset the status.
  * If the integration with Google Calendar is enabled, the events will be reflected in the calendar.

- Time off requests
  * The admins can send the time off requests on behalf of the users.
  * If the integration with Google Calendar is enabled, the events will be reflected in the calendar.

- Daily reports
  * The bot prepares the daily reports about the users who are out of the office; the reports are passed to the `#general` according to the schedule`VIVA_REPORT_SCHEDULER`.

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
| `VIVA_REPORT_SCHEDULER` | Allows specifying the frequency with which script checks status of all users and forms the list of absence users (start vacation/work from home day) or users who come at work first day after a break (back from vacation), sorted by the reason, and sends it to `general` channel. The value of this parameter should correspond to [Cron Format](https://github.com/node-schedule/node-schedule#cron-style-scheduling). | `0 0 11 * * *` |

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

The following commands are
* intended only for debugging purposes, so it's not present in the available Hubot commands list;
* for admin use only.

### Update vacation dates

```
some.user >> hubot viva reset @user.name 15.10.2015 25.10.2015
    hubot >> Даты отпуска успешно перезаписаны!
             @user.name в отпуске с 15.10.2015 по 25.10.2015.
```

In this case the leave start of the user named `user.name` was changed to `15.10.2015` (October 15 2015) and the leave end was changed to `25.10.2015` (October 25 2015). It is not mandatory to set both dates, if you replace one of them by `*` it will stay unchanged. It allows simulating returning and starting vacation.

### Reset user state

Command `viva default` is clearing all user temporary attributes.

```
some.user >> hubot viva default @user.name
    hubot >> Состояние пользователя очищено.
```

It doesn't delete information about user vacation, time off, work from home and illing. It clears only temporary attributes used to navigate user though command scenarios.

## Integration with Google Calendar

First, create a Google account or use an existing one. Next, visit [Google Cloud Console](https://console.cloud.google.com) and create a project there. Then, go to APIs & Services and enable Google Calendar API. After that, go to the [Credentials](https://console.cloud.google.com/apis/credentials) section and create a Service account key – a `.json` file will be returned as a result. Finally, find the `client_email` field in the file and give the contact specified in the field the permissions to edit the calendar specified via the `GOOGLE_CALENDAR_NAME` parameter.

## Authors

See [AUTHORS](AUTHORS.md).

## Licensing

hubot-viva-las-vegas is available under the [Apache License, Version 2.0](LICENSE).
