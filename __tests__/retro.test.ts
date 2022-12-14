import {nextDate, newDate, nextDriver, tryCreateRetro} from '../src/retro'
import * as api from '../src/api'
import * as github from '@actions/github'
import * as mockdate from 'mockdate'
import {defaultColumnNames, defaultTitleTemplate} from '../src/defaults'
import dateFormat from 'date-format'

jest.mock('../src/api')

describe('test tryCreateRetro', () => {
  const client = new github.GitHub('fakeToken')

  const findLatestRetroMock = jest.spyOn(api, 'findLatestRetro')
  const createBoardMock = jest.spyOn(api, 'createBoard')
  const closeBoardMock = jest.spyOn(api, 'closeBoard')
  const updateBoardDescriptionMock = jest.spyOn(api, 'updateBoardDescription')
  const createIssueMock = jest.spyOn(api, 'createIssue')
  const closeIssueMock = jest.spyOn(api, 'closeIssue')
  const sendNotificationMock = jest.spyOn(api, 'sendNotification')

  beforeEach(() => {
    jest.resetAllMocks()
    mockdate.reset()
    mockdate.set('2020-09-15T08:00:00.000Z')

    createBoardMock.mockImplementation((client, title, retroInfo, columnNames, cards, view, onlyLog) => {
      return Promise.resolve({
        id: 1,
        url: 'http://github.com/my-org/my-url/projects/1'
      })
    })

    createIssueMock.mockImplementation((client, title, retro, template, view, onlyLog) => {
      return Promise.resolve({
        id: 1,
        url: 'http://github.com/my-org/my-url/issues/1'
      })
    })
  })

  test('no board exists', async () => {
    await tryCreateRetro(client, {
      teamName: 'Test Team',
      handles: ['alice', 'bob'],
      retroCadenceInWeeks: 2,
      retroDayOfWeek: 3,
      titleTemplate: 'Test Title',
      notificationUrl: '',
      notificationTemplate: '',
      closeAfterDays: 0,
      createTrackingIssue: false,
      issueTemplate: '',
      columns: [],
      cards: '',
      onlyLog: false,
      dateFormat: ''
    })

    expect(findLatestRetroMock).toHaveBeenCalledTimes(1)
    expect(createBoardMock).toHaveBeenCalledTimes(1)
    expect(createIssueMock).toHaveBeenCalledTimes(0)
    expect(sendNotificationMock).toHaveBeenCalledTimes(0)
    expect(updateBoardDescriptionMock).toHaveBeenCalledTimes(0)
    expect(closeBoardMock).toHaveBeenCalledTimes(0)
    expect(closeIssueMock).toHaveBeenCalledTimes(0)

    expect(createBoardMock).toHaveBeenCalledWith(
      client,
      'Test Title',
      {
        team: 'Test Team',
        date: expect.any(Date),
        driver: 'alice',
        offset: 0
      },
      [],
      '',
      expect.anything(),
      false
    )
  })

  test('last retro found', async () => {
    const lastRetroDate = newDate(-1)

    findLatestRetroMock.mockImplementation((client, teamName) => {
      return Promise.resolve({
        title: 'Test Retro',
        url: 'https://github.com/my-org/my-repo/projects/1',
        projectId: 1,
        state: 'open',
        team: teamName,
        date: lastRetroDate,
        driver: 'alice',
        offset: 0,
        issue: undefined
      })
    })

    await tryCreateRetro(client, {
      teamName: 'Test Team',
      handles: ['alice', 'bob'],
      retroCadenceInWeeks: 2,
      retroDayOfWeek: lastRetroDate.getDay(),
      titleTemplate: 'Test Title',
      notificationUrl: '',
      notificationTemplate: '',
      closeAfterDays: 0,
      createTrackingIssue: false,
      issueTemplate: '',
      columns: [],
      cards: '',
      onlyLog: false,
      dateFormat: ''
    })

    expect(findLatestRetroMock).toHaveBeenCalledTimes(1)
    expect(createBoardMock).toHaveBeenCalledTimes(1)
    expect(createIssueMock).toHaveBeenCalledTimes(0)
    expect(sendNotificationMock).toHaveBeenCalledTimes(0)
    expect(updateBoardDescriptionMock).toHaveBeenCalledTimes(0)
    expect(closeBoardMock).toHaveBeenCalledTimes(0)
    expect(closeIssueMock).toHaveBeenCalledTimes(0)

    const expectedDate = new Date(lastRetroDate)
    expectedDate.setDate(expectedDate.getDate() + 14)

    expect(createBoardMock).toHaveBeenCalledWith(
      client,
      'Test Title',
      {
        team: 'Test Team',
        date: expectedDate,
        driver: 'bob',
        offset: 1
      },
      [],
      '',
      expect.anything(),
      false
    )
  })

  test('no-op if retro in future', async () => {
    const lastRetroDate = newDate(3)

    findLatestRetroMock.mockImplementation((client, teamName) => {
      return Promise.resolve({
        title: 'Test Retro',
        url: 'https://github.com/my-org/my-repo/projects/1',
        projectId: 1,
        state: 'open',
        team: teamName,
        date: lastRetroDate,
        driver: 'alice',
        offset: 0,
        issue: undefined
      })
    })

    await tryCreateRetro(client, {
      teamName: 'Test Team',
      handles: ['alice', 'bob'],
      retroCadenceInWeeks: 2,
      retroDayOfWeek: lastRetroDate.getDay(),
      titleTemplate: 'Test Title',
      notificationUrl: '',
      notificationTemplate: '',
      closeAfterDays: 0,
      createTrackingIssue: false,
      issueTemplate: '',
      columns: [],
      cards: '',
      onlyLog: false,
      dateFormat: ''
    })

    expect(findLatestRetroMock).toHaveBeenCalledTimes(1)
    expect(createBoardMock).toHaveBeenCalledTimes(0)
    expect(createIssueMock).toHaveBeenCalledTimes(0)
    expect(sendNotificationMock).toHaveBeenCalledTimes(0)
    expect(updateBoardDescriptionMock).toHaveBeenCalledTimes(0)
    expect(closeBoardMock).toHaveBeenCalledTimes(0)
    expect(closeIssueMock).toHaveBeenCalledTimes(0)
  })

  test('notification sent on the day of retro', async () => {
    findLatestRetroMock.mockImplementation((client, teamName) => {
      return Promise.resolve({
        title: 'Test Retro',
        url: 'https://github.com/my-org/my-repo/projects/1',
        projectId: 1,
        state: 'open',
        team: teamName,
        date: new Date(),
        driver: 'alice',
        offset: 0,
        issue: undefined
      })
    })

    await tryCreateRetro(client, {
      teamName: 'Test Team',
      handles: ['alice', 'bob'],
      retroCadenceInWeeks: 2,
      retroDayOfWeek: 3,
      titleTemplate: 'Test Title',
      notificationUrl: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
      notificationTemplate: '',
      closeAfterDays: 0,
      createTrackingIssue: true,
      issueTemplate: '',
      columns: [],
      cards: '',
      onlyLog: true,
      dateFormat: ''
    })

    expect(findLatestRetroMock).toHaveBeenCalledTimes(1)
    expect(createBoardMock).toHaveBeenCalledTimes(0)
    expect(createIssueMock).toHaveBeenCalledTimes(0)
    expect(sendNotificationMock).toHaveBeenCalledTimes(1)
    expect(updateBoardDescriptionMock).toHaveBeenCalledTimes(0)
    expect(closeBoardMock).toHaveBeenCalledTimes(0)
    expect(closeIssueMock).toHaveBeenCalledTimes(0)
  })

  test('close old board and issue', async () => {
    findLatestRetroMock.mockImplementation((client, teamName, before) => {
      if (before && before < newDate(3)) {
        return Promise.resolve({
          title: 'Test Retro',
          url: 'https://github.com/my-org/my-repo/projects/1',
          projectId: 1,
          state: 'open',
          team: teamName,
          date: newDate(-8),
          driver: 'bob',
          offset: 1,
          issue: 1
        })
      } else {
        return Promise.resolve({
          title: 'Test Retro',
          url: 'https://github.com/my-org/my-repo/projects/2',
          projectId: 2,
          state: 'open',
          team: teamName,
          date: newDate(3),
          driver: 'alice',
          offset: 0,
          issue: 2
        })
      }
    })

    await tryCreateRetro(client, {
      teamName: 'Test Team',
      handles: ['alice', 'bob'],
      retroCadenceInWeeks: 2,
      retroDayOfWeek: 3,
      titleTemplate: 'Test Title',
      notificationUrl: '',
      notificationTemplate: '',
      closeAfterDays: 7,
      createTrackingIssue: false,
      issueTemplate: '',
      columns: [],
      cards: '',
      onlyLog: false,
      dateFormat: ''
    })

    expect(findLatestRetroMock).toHaveBeenCalledTimes(2)
    expect(createBoardMock).toHaveBeenCalledTimes(0)
    expect(createIssueMock).toHaveBeenCalledTimes(0)
    expect(sendNotificationMock).toHaveBeenCalledTimes(0)
    expect(updateBoardDescriptionMock).toHaveBeenCalledTimes(0)
    expect(closeBoardMock).toHaveBeenCalledTimes(1)
    expect(closeIssueMock).toHaveBeenCalledTimes(1)

    expect(closeBoardMock).toHaveBeenCalledWith(
      client,
      {
        team: 'Test Team',
        date: expect.any(Date),
        driver: 'bob',
        offset: 1,
        issue: 1,
        projectId: 1,
        state: 'open',
        title: 'Test Retro',
        url: expect.any(String)
      },
      false
    )

    expect(closeIssueMock).toHaveBeenCalledWith(client, 1, false)
  })

  test('create issue euro format', async () => {
    await tryCreateRetro(client, {
      teamName: 'Test Team',
      handles: ['alice', 'bob'],
      retroCadenceInWeeks: 2,
      retroDayOfWeek: 3,
      titleTemplate: defaultTitleTemplate,
      notificationUrl: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
      notificationTemplate: '',
      closeAfterDays: 0,
      createTrackingIssue: true,
      issueTemplate: '',
      columns: [],
      cards: '',
      onlyLog: true,
      dateFormat: 'dd/MM/yyyy'
    })

    expect(createBoardMock).toHaveBeenCalledWith(
      client,
      'Test Team Retro on 30/09/2020',
      {
        team: 'Test Team',
        date: expect.any(Date),
        driver: 'alice',
        offset: 0
      },
      [],
      '',
      expect.anything(),
      true
    )

    expect(createIssueMock).toHaveBeenCalledWith(
      client,
      'Test Team Retro on 30/09/2020',
      {
        team: 'Test Team',
        date: expect.any(Date),
        driver: 'alice',
        offset: 0
      },
      '',
      expect.anything(),
      true
    )
  })

  test('create issue', async () => {
    await tryCreateRetro(client, {
      teamName: 'Test Team',
      handles: ['alice', 'bob'],
      retroCadenceInWeeks: 2,
      retroDayOfWeek: 3,
      titleTemplate: defaultTitleTemplate,
      notificationUrl: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
      notificationTemplate: '',
      closeAfterDays: 0,
      createTrackingIssue: true,
      issueTemplate: '',
      columns: [],
      cards: '',
      onlyLog: true,
      dateFormat: 'yyyy-MM-dd'
    })

    expect(findLatestRetroMock).toHaveBeenCalledTimes(1)
    expect(createBoardMock).toHaveBeenCalledTimes(1)
    expect(createIssueMock).toHaveBeenCalledTimes(1)
    expect(sendNotificationMock).toHaveBeenCalledTimes(0)
    expect(updateBoardDescriptionMock).toHaveBeenCalledTimes(1)
    expect(closeBoardMock).toHaveBeenCalledTimes(0)
    expect(closeIssueMock).toHaveBeenCalledTimes(0)

    expect(createBoardMock).toHaveBeenCalledWith(
      client,
      'Test Team Retro on 2020-09-30',
      {
        team: 'Test Team',
        date: expect.any(Date),
        driver: 'alice',
        offset: 0
      },
      [],
      '',
      expect.anything(),
      true
    )

    expect(createIssueMock).toHaveBeenCalledWith(
      client,
      'Test Team Retro on 2020-09-30',
      {
        team: 'Test Team',
        date: expect.any(Date),
        driver: 'alice',
        offset: 0
      },
      '',
      expect.anything(),
      true
    )

    expect(updateBoardDescriptionMock).toHaveBeenCalledWith(
      client,
      1,
      {
        team: 'Test Team',
        date: expect.any(Date),
        driver: 'alice',
        offset: 0,
        issue: 1
      },
      true
    )
  })
})

test('test newDate', async () => {
  const expected = new Date().getTime()

  let actual = newDate().getTime()
  expect(Math.abs(actual - expected)).toBeLessThan(100)

  actual = newDate(1).getTime()
  expect(actual - expected).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000)

  actual = newDate(-1).getTime()
  expect(actual - expected).toBeLessThan(-(24 * 60 * 60 * 1000) + 1000) // add 1 sec

  let date1 = newDate(1, true)
  let date2 = newDate(0, true)
  expect(date1.getHours()).toBe(0)
  expect(date1.getMinutes()).toBe(0)
  expect(date1.getSeconds()).toBe(0)
  expect(date1.getMilliseconds()).toBe(0)
  expect(date1 > date2).toBeTruthy()
})

describe('test nextDate', () => {
  test('bi-weekly', async () => {
    mockdate.set('2020-09-15T08:00:00.000Z')

    expect(nextDate(new Date('2020-09-13T12:00:00.000Z'), 3, 2)).toStrictEqual(new Date('2020-09-30T12:00:00.000Z'))
    expect(nextDate(new Date('2020-09-14T12:00:00.000Z'), 3, 2)).toStrictEqual(new Date('2020-09-30T12:00:00.000Z'))
    expect(nextDate(new Date('2020-09-15T12:00:00.000Z'), 3, 2)).toStrictEqual(new Date('2020-09-30T12:00:00.000Z'))
    expect(nextDate(new Date('2020-09-16T12:00:00.000Z'), 3, 2)).toStrictEqual(new Date('2020-09-30T12:00:00.000Z'))
    expect(nextDate(new Date('2020-09-17T12:00:00.000Z'), 3, 2)).toStrictEqual(new Date('2020-10-07T12:00:00.000Z'))
    expect(nextDate(new Date('2020-09-18T12:00:00.000Z'), 3, 2)).toStrictEqual(new Date('2020-10-07T12:00:00.000Z'))
    expect(nextDate(new Date('2020-09-19T12:00:00.000Z'), 3, 2)).toStrictEqual(new Date('2020-10-07T12:00:00.000Z'))

    mockdate.reset()
  })

  test('weekly', async () => {
    mockdate.set('2020-09-15T08:00:00.000Z')

    expect(nextDate(new Date('2020-09-13T12:00:00.000Z'), 4, 1)).toStrictEqual(new Date('2020-09-24T12:00:00.000Z'))
    expect(nextDate(new Date('2020-09-14T12:00:00.000Z'), 4, 1)).toStrictEqual(new Date('2020-09-24T12:00:00.000Z'))
    expect(nextDate(new Date('2020-09-15T12:00:00.000Z'), 4, 1)).toStrictEqual(new Date('2020-09-24T12:00:00.000Z'))
    expect(nextDate(new Date('2020-09-16T12:00:00.000Z'), 4, 1)).toStrictEqual(new Date('2020-09-24T12:00:00.000Z'))
    expect(nextDate(new Date('2020-09-17T12:00:00.000Z'), 4, 1)).toStrictEqual(new Date('2020-09-24T12:00:00.000Z'))
    expect(nextDate(new Date('2020-09-18T12:00:00.000Z'), 4, 1)).toStrictEqual(new Date('2020-10-01T12:00:00.000Z'))
    expect(nextDate(new Date('2020-09-19T12:00:00.000Z'), 4, 1)).toStrictEqual(new Date('2020-10-01T12:00:00.000Z'))

    mockdate.reset()
  })

  test('scheduled retro in past', async () => {
    mockdate.set('2020-10-15T08:00:00.000Z')

    expect(nextDate(new Date('2020-09-13T12:00:00.000Z'), 3, 2)).toStrictEqual(new Date('2020-10-28T08:00:00.000Z'))
    expect(nextDate(new Date('2020-09-14T12:00:00.000Z'), 3, 2)).toStrictEqual(new Date('2020-10-28T08:00:00.000Z'))
    expect(nextDate(new Date('2020-09-15T12:00:00.000Z'), 3, 2)).toStrictEqual(new Date('2020-10-28T08:00:00.000Z'))
    expect(nextDate(new Date('2020-09-16T12:00:00.000Z'), 3, 2)).toStrictEqual(new Date('2020-10-28T08:00:00.000Z'))
    expect(nextDate(new Date('2020-09-17T12:00:00.000Z'), 3, 2)).toStrictEqual(new Date('2020-10-28T08:00:00.000Z'))
    expect(nextDate(new Date('2020-09-18T12:00:00.000Z'), 3, 2)).toStrictEqual(new Date('2020-10-28T08:00:00.000Z'))
    expect(nextDate(new Date('2020-09-19T12:00:00.000Z'), 3, 2)).toStrictEqual(new Date('2020-10-28T08:00:00.000Z'))

    mockdate.reset()
  })
})

describe('test nextDriver', () => {
  let handles = ['alice', 'bob', 'charlie', 'denise', 'erica']

  test('single user', async () => {
    expect(nextDriver(['alice'], '')).toBe('alice')
    expect(nextDriver(['alice'], 'alice')).toBe('alice')
  })

  test('full cycle', async () => {
    expect(nextDriver(handles, '')).toBe('alice')
    expect(nextDriver(handles, 'alice')).toBe('bob')
    expect(nextDriver(handles, 'denise')).toBe('erica')
    expect(nextDriver(handles, 'erica')).toBe('alice')
  })

  test('test missing handle', async () => {
    expect(nextDriver(handles, 'frank')).toBe('alice')
    expect(nextDriver(handles, 'frank', 1)).toBe('bob')
  })
})
