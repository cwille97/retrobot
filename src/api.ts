import * as core from '@actions/core'
import * as github from '@actions/github'
import {default as axios} from 'axios'
import * as mustache from 'mustache'
import {IRetro, IRetroInfo, IProjectBoard, IIssue} from './types'
import {defaultColumnNames, defaultNotificationEmoji} from './defaults'

/**
 * Prefix used in the project board description to identify projects created
 * by this code.
 */
const bodyPrefix = 'Retrobot: '

/**
 * Encodes an IRetroInfo object into a string that can be stored in the
 * project board description or elsewhere.
 *
 * @param info the IRetroInfo object to encode
 */
export function toProjectDescription(info: IRetroInfo): string {
  return bodyPrefix + JSON.stringify(info)
}

/**
 * Parses a string containing an encoded IRetroInfo object that was produced
 * by {@link toProjectDescription}.
 *
 * @param info the string representation
 * @returns the parsed IRetroInfo object
 */
export function parseProjectDescription(info: string): IRetroInfo {
  if (info.startsWith(bodyPrefix)) {
    const content = JSON.parse(info.substring(bodyPrefix.length))

    return {
      team: content['team'],
      date: new Date(content['date']),
      driver: content['driver'],
      offset: parseInt(content['offset']),
      issue: content['issue'] ? parseInt(content['issue']) : undefined
    }
  } else {
    throw Error(`not a valid retro body: ${info}`)
  }
}

/**
 * Finds the last retro.
 *
 * @param client the GitHub client
 * @param teamName the team name, or '' if not defined
 * @param before if specified, finds the last retro before the given date
 * @returns information about the last retro, or undefined if no matching retro found
 */
export async function findLatestRetro(
  client: github.GitHub,
  teamName: string,
  before?: Date
): Promise<IRetro | undefined> {
  core.info('Locating the last retro...')

  const parseRetro = (proj: any): IRetro => {
    const info = parseProjectDescription(proj.body)

    return {
      title: proj.name,
      url: proj.html_url,
      projectId: proj.id,
      state: proj.state,
      date: info.date,
      team: info.team,
      driver: info.driver,
      offset: info.offset,
      issue: info.issue
    }
  }

  const retros: IRetro[] = []

  for await (const result of client.paginate.iterator(
    client.projects.listForRepo.endpoint.merge({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      state: 'all'
    })
  )) {
    const response: any[] = result.data

    if (response) {
      core.info(`Loading page containing ${response.length} projects`)

      for (const retro of response.filter(proj => proj.body.startsWith(bodyPrefix)).map(parseRetro)) {
        retros.push(retro)
      }
    } else {
      core.error(`Unexpected response: ${result}`)
    }
  }

  const sorted = retros
    .filter(retro => (teamName ? teamName === retro.team : !retro.team))
    .filter(retro => (before ? retro.date < before : true))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .reverse()

  core.info(`Found ${sorted.length} retro projects for this repo`)

  return sorted.length > 0 ? sorted[0] : undefined
}

/**
 * Closes the last retro board.
 *
 * @param client the GitHub client
 * @param retro the retro to close
 */
export async function closeBoard(client: github.GitHub, retro: IRetro, onlyLog: boolean): Promise<void> {
  if (!onlyLog) {
    await client.projects.update({
      project_id: retro.projectId,
      state: 'closed'
    })
  }
}

/**
 * Creates a new project board for the retro.
 *
 * In addition to creating the project board and setting up the columns, this also populates the
 * board with a few standard cards including:
 *
 *   1. The current retro driver
 *   2. The next retro driver
 *   3. A link to the previous retro
 *
 * These cards will be added to the last column, which should be reserved for "action items" or
 * informational use.
 *
 * @param client the GitHub client
 * @param title the title of the retro
 * @param retroInfo information used to create and schedule the new retro
 * @param columnNames custom column names, or [] to use the defaults
 * @param cards formatted string describing any custom cards to populate on the board
 * @param view the view used to render any mustache templates
 * @param onlyLog if true, will not create the board
 */
export async function createBoard(
  client: github.GitHub,
  title: string,
  retroInfo: IRetroInfo,
  columnNames: string[],
  cards: string,
  view: any,
  onlyLog: boolean
): Promise<IProjectBoard> {
  let projectId = 0
  let projectUrl = ''

  if (!onlyLog) {
    const project = await client.projects.createForRepo({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      name: title,
      body: toProjectDescription(retroInfo)
    })

    projectId = project.data.id
    projectUrl = project.data.html_url
  }

  if (!columnNames.length) {
    columnNames = defaultColumnNames
  }

  const columnMap = await populateColumns(client, projectId, columnNames, onlyLog)

  if (cards) {
    await populateCards(client, cards, view, columnMap, onlyLog)
  }

  return {
    id: projectId,
    url: projectUrl
  }
}

/**
 * Updates the JSON string stored in the project board description.
 *
 * @param client the GitHub client
 * @param projectId the project board id
 * @param retroInfo the new information to store
 * @param onlyLog if true, will not update the project board
 */
export async function updateBoardDescription(
  client: github.GitHub,
  projectId: number,
  retroInfo: IRetroInfo,
  onlyLog: boolean
): Promise<void> {
  if (!onlyLog) {
    await client.projects.update({
      project_id: projectId,
      body: toProjectDescription(retroInfo)
    })
  }

  core.info(`Updated description of project board ${projectId}`)
}

/**
 * Populates the columns on the project board.
 *
 * @param client the GitHub client
 * @param projectId the project board id
 * @param columnNames the names of the columns
 * @param onlyLog if true, will not add any columns to the board
 */
export async function populateColumns(
  client: github.GitHub,
  projectId: number,
  columnNames: string[],
  onlyLog: boolean
): Promise<{[key: string]: number}> {
  const columnMap: {[key: string]: number} = {}

  for (const name of columnNames) {
    core.info(`Creating column '${name}'`)

    if (!onlyLog) {
      const column = await client.projects.createColumn({
        project_id: projectId,
        name
      })

      columnMap[name] = column.data.id
    }
  }

  return columnMap
}

/**
 * Populates any custom cards on the project board.
 *
 * @param client the GitHub client
 * @param cards formatted string specifying the cards to generate
 * @param view the view for rendering mustache templates
 * @param columnMap map of column names to ids
 * @param onlyLog if true, will not add any cards to the project board
 */
export async function populateCards(
  client: github.GitHub,
  cards: string,
  view: any,
  columnMap: {[key: string]: number},
  onlyLog: boolean
): Promise<void> {
  if (!cards) {
    core.info('No cards to render')
    return
  }

  for (const card of cards
    .split('\n')
    .map(c => c.trim())
    .reverse()) {
    const parts = card.split('=>').map(p => p.trim())
    const text = mustache.render(parts[0], view)
    const column = parts[1]

    if (text) {
      core.info(`Adding card '${text}' to column '${column}'`)

      if (!onlyLog) {
        const columnId = columnMap[column]

        if (columnId) {
          await client.projects.createCard({
            column_id: columnId,
            note: text
          })
        } else {
          core.info(`Card not rendered, no matching column: ${column}`)
        }
      }
    } else {
      core.info(`Card not rendered, text is empty: ${parts[0]}`)
    }
  }
}

/**
 * Creates a tracking issue for the retro driver.
 *
 * @param client the GitHub client
 * @param title the issue title
 * @param assignee the GitHub handle of the retro driver
 * @param template the mustache template used to generate the issue text
 * @param view view for rendering the mustache template
 * @param onlyLog if true, will not create the tracking issue
 */
export async function createIssue(
  client: github.GitHub,
  title: string,
  retro: IRetroInfo,
  template: string,
  view: any,
  onlyLog: boolean
): Promise<IIssue> {
  let issueNumber = 0
  let issueUrl = ''

  if (!onlyLog) {
    const issue = await client.issues.create({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      title,
      body: mustache.render(template, view),
      labels: ['retrobot']
    })

    await client.issues.addAssignees({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: issue.data.number,
      assignees: [retro.driver]
    })

    issueNumber = issue.data.number
    issueUrl = issue.data.html_url
  }

  return {
    id: issueNumber,
    url: issueUrl
  }
}

/**
 * Close the issue.
 *
 * @param client the GitHub client
 * @param issueNumber the issue number to close
 * @param onlyLog if true, will not close the issue
 */
export async function closeIssue(client: github.GitHub, issueNumber: number, onlyLog: boolean): Promise<void> {
  try {
    const res = await client.issues.get({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: issueNumber
    })

    if (res.data.state === 'open') {
      if (!onlyLog) {
        await client.issues.update({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          issue_number: issueNumber,
          state: 'closed'
        })
      }

      core.info(`Closed issue ${res.data.html_url}`)
    } else {
      core.info(`Issue ${res.data.html_url} is already closed`)
    }
  } catch (error) {
    core.info(`Failed to get issue: ${error}`)
  }
}

/**
 * Sends a slack notification announcing a retro is scheduled for today.
 *
 * @param notificationUrl the incoming webhooks notification url
 * @param notificationTemplate the mustache template used to generate the notification text
 * @param view view for rendering the mustache template
 * @param onlyLog if true, will not issue the notification
 */
export async function sendNotification(
  notificationUrl: string,
  notificationTemplate: string,
  view: any,
  onlyLog: boolean
): Promise<void> {
  if (!onlyLog) {
    const body = {
      username: 'Retrobot',
      text: mustache.render(notificationTemplate, view),
      icon_emoji: defaultNotificationEmoji,
      link_names: true
    }

    const res = await axios.post(notificationUrl, body)
    core.info(res.statusText)
  }
}
