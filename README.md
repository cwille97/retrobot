# Retrobot

Retrobot automates the creation of retrospective boards on GitHub.  In addition to creating the board, it can also create a tracking issue assigned to the retro driver and send a Slack notification the day of the retro.

See [Retrobot's project boards](https://github.com/dhadka/retrobot/projects) for an example.

## Development history

Retrobot is based heavily off of [hross/retro-board-creator](https://github.com/hross/retro-board-creator), with the following additions:

1. Adds `team-name` input to distinguish multiple teams using the same repo.
2. Stores and reads the current retro settings in the project description (encoded as JSON).
3. Option to populate board with custom columns and cards.
4. Option to send slack notifications on the day of the retro.
5. Option to close prior retro boards.
6. Everything is customizable via mustache templates with `{{ variable }}` rendering

## Example workflows

### Minimal example

```
name: Create retro board every Friday

on:
  schedule:
    - cron: '0 14 * * *'

jobs:
  create-board:
    steps:
    - uses: dhadka/retrobot@master
      with: 
        repo-token: ${{ secrets.GITHUB_TOKEN }}
        handles: alice,bob,charlie,denise,erica
```

### Advanced example

Schedules a bi-weekly retro on Wednesday.  Demonstrates customizing the columns and cards of the retro board, creating an issue, and sending notifications.  When using these advanced features, you should schedule the workflow to run daily, before the scheduled time of the retro, so Retrobot can send notifications at an appropriate time.

```
name: Create retro board

on:
  schedule:
    - cron: '0 14 * * *'

jobs:
  create-board:
    steps:
    - uses: dhadka/retrobot@master
      with: 
        repo-token: ${{ secrets.GITHUB_TOKEN }}
        team-name: My Team
        handles: alice,bob,charlie,denise,erica
        retro-cadence-weeks: 2
        retro-day-of-week: wednesday
        create-tracking-issue: true
        notification-url: https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX
        close-after-days: 7
        columns: Shoutouts, What went well, What could be better, Action items!
        cards: |
          Retrobot is now creating retros! => Shoutouts
          Today's retro driver: {{ driver }} => Action items!
          Next retro driver: {{ next-driver }} => Action items!
          {{ #last-retro }}Last retro: {{{ url }}}{{ /last-retro }} => Action items!
```

## Custom options

| Option        | Description    |
|---------------|----------------|
| `team-name`   | Team name to include in the retro title and announcements. This is useful if multiple teams are using retrobot within the same repo. |
| `retro-cadence-weeks` | The frequency of retros, in weeks.  The default is `1`. |
| `retro-day-of-week`   | The day of the week to hold the retro. Single value from 0-7 where 0 is Sunday |
| `title-template`      | Template used to generate the retro title. |
| `notification-url`    | Slack incoming webhooks url to send a notification the day of the retro.  This requires the Action schedule trigger to be configured to run a few hours before the start of the retro. |
| `notification-template` |  Template used to generate the notification text. |
| `close-after-days`      | When set, the previous retro board will be automatically closed after the given number of days. |
| `create-tracking-issue` | If `true`, will create a tracking issue for the upcoming retro and assign it to the driver.  Default is `false`. |
| `issue-template`        | Template used to generate the body of the issue. |
| `columns`               | Comma separated list of column names. If not specified, defaults to `"Went well", "Went meh", "Could have gone better", Action items!"`. |
| `cards`                 | Custom cards added to the project board.  This is input as a multiline string, where each line represents a card.  The format of a card is `<note> => <column_name>`.  See the [advanced example](#advanced-example) for a sample. |
| `only-log` | Log what actions would be performed, but do not actually create the retro board, issue, or notifications.  Useful for testing. |
| `date-format` | Provide a format to use for outputting dates, based on options available in the [date-format npm package](https://www.npmjs.com/package/date-format). |

## Template rendering

Retrobot uses Mustache to render templates.  Reference any variable below with `{{ variable_name }}` in the template string.  The following variables are available:

* `title` - The title of the retro
* `date` - The date of the retro
* `driver` - The GitHub handle of the retro driver
* `url` - The url to the current retro board (only available for issue creation and notifications)
* `team` - The team name (if set)
* `next-driver` - The GitHub handle of the following retro driver

In addition, if a previous retro is found, the `last-retro` variable will be set which contains

* `title` - The title of the previous retro
* `date` - The date of the previous retro
* `driver` - The GitHub handle of the previous retro driver
* `url` - The url to the previous retro's project board

You can reference these variables using, for example, `{{ #last-retro }}Last retro: {{{ url }}}{{ /last-retro }}`.  If `last-retro` does not exist, the entire contents of the string will not be rendered (and as a result the card will not be created).

**Note: Mustache automatically escapes strings for HTML. Disable escaping by using three brackets `{{{ ... }}}`.  This is recommended for urls and dates.**

## Changing the schedule

Retrobot uses information stored in the project board description.  It is encoded as a JSON string and can be easily edited to change the upcoming retro schedule.

### Changing date

Does the retro fall on a holiday?  Need to reschedule one retro to a different day of the week?  Find and change the `date` field in the JSON.  Retrobot will automatically use the new date.  Furthermore, all future retros will be shifted accordingly if you skip weeks.

### Changing cadence or day of week

Modify the `retro-cadence-weeks` and/or `retro-day-of-week` settings in the Action workflow.  You will need to manually change any existing retro project boards, but all future retros will use the new schedule.

### Changing retro driver

The retro driver order can be changed at any time by editing the `handles` setting.  You can also add or remove handles at any time.  However, this will not change any existing retro project boards.  If you need update the driver for the existing retro, it is a good idea to change both the `driver` name in the JSON as well as update the `handles` in the workflow file to ensure the order of future retro drivers is unchanged.

### Bootstrapping schedule

If you used project boards in the past for retros and want to start using Retrobot, you can bootstrap the schedule by editing the last retro and putting the following in the description:

```
Retrobot: {"date":"2020-09-30T12:00:00.000Z","team":"Team Name","driver":"alice","offset":0}
```

being sure to set the date, team name, and driver to the appropriate values for the last retro.

## How to contribute

Install the dependencies  
```bash
$ npm install
```

Build the typescript and package it for distribution
```bash
$ npm run build && npm run pack
```

Run the tests :heavy_check_mark:  
```bash
$ npm test
```
