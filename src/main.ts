import * as core from '@actions/core'
import * as github from '@actions/github'
import {IRetroArguments} from './types'
import {tryCreateRetro} from './retro'
import {getList, getBoolean, getString, getInt, parseDayOfWeek} from './utils'
import {defaultTitleTemplate, defaultNotificationTemplate, defaultIssueTemplate} from './defaults'

async function run(): Promise<void> {
  core.info('Starting retro creator')

  try {
    const client = new github.GitHub(getString('repo-token', {required: true}))

    const args: IRetroArguments = {
      teamName: getString('team-name'),
      handles: getList('handles', {required: true}),
      retroCadenceInWeeks: getInt('retro-cadence-weeks', {default: 1}),
      retroDayOfWeek: parseDayOfWeek(getString('retro-day-of-week', {default: 'friday'})),
      titleTemplate: getString('title-template', {default: defaultTitleTemplate}),
      notificationUrl: getString('notification-url'),
      notificationTemplate: getString('notification-template', {default: defaultNotificationTemplate}),
      closeAfterDays: getInt('close-after-days', {default: 0}),
      createTrackingIssue: getBoolean('create-tracking-issue'),
      issueTemplate: getString('issue-template', {default: defaultIssueTemplate}),
      columns: getList('columns'),
      cards: getString('cards'),
      onlyLog: getBoolean('only-log'),
      dateFormat: getString('date-format', {default: 'dd-MM-yyyy'})
    }

    core.info('Arguments parsed. Starting creation.')

    await tryCreateRetro(client, args)
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

run()
