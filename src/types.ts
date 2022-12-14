export interface IRetroArguments {
  teamName: string
  handles: string[]
  retroCadenceInWeeks: number
  retroDayOfWeek: number
  titleTemplate: string
  notificationUrl: string
  notificationTemplate: string
  closeAfterDays: number
  createTrackingIssue: boolean
  issueTemplate: string
  columns: string[]
  cards: string
  onlyLog: boolean
  dateFormat: string
}

/**
 * Stores information about a retro.  This information is encoded as JSON in the
 * project board description.
 */
export interface IRetroInfo {
  /**
   * The team name.
   */
  team: string

  /**
   * The retro date.
   */
  date: Date

  /**
   * The retro driver GitHub handle.
   */
  driver: string

  /**
   * The offset number for the current retro driver.
   */
  offset: number

  /**
   * The issue id, if created.
   */
  issue: number | undefined
}

/**
 * Extends {@link IRetroInfo} to include information about the existing
 * project board.
 */
export type IRetro = IRetroInfo & {
  /**
   * The title of the retro.
   */
  title: string

  /**
   * The URL to the project board.
   */
  url: string

  /**
   * The project board id used by the GitHub client.
   */
  projectId: number

  /**
   * The state of the project.
   */
  state: string
}

/**
 * Identifies a specific project board.
 */
export interface IProjectBoard {
  id: number

  url: string
}

/**
 * Identifies a specific issue.
 */
export interface IIssue {
  id: number

  url: string
}
