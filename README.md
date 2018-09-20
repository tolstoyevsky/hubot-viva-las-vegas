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

## Authors

See [AUTHORS](AUTHORS.md).

## Licensing

hubot-viva-las-vegas is available under the [Apache License, Version 2.0](LICENSE).
