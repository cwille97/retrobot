import {
  findLatestRetro,
  parseProjectDescription,
  populateColumns,
  populateCards,
  toProjectDescription,
  createIssue,
  closeIssue,
  sendNotification
} from '../src/api'
import {IRetroInfo} from '../src/types'
import * as github from '@actions/github'
import nock = require('nock')
import {defaultNotificationEmoji} from '../src/defaults'

function createProjectJson(id: number, name: string, body: string, date: Date): any {
  return {
    owner_url: 'https://api.github.com/repos/my-org/my-repo',
    url: `https://api.github.com/projects/${id}`,
    html_url: 'https://github.com/my-org/my-repo/projects/1',
    columns_url: `https://api.github.com/projects/${id}/columns`,
    id: id,
    node_id: 'unused',
    name: name,
    body: body,
    number: 1,
    state: 'open',
    creator: {
      login: 'octocat',
      id: 1,
      node_id: 'unused',
      avatar_url: 'https://github.com/images/error/octocat_happy.gif',
      gravatar_id: '',
      url: 'https://api.github.com/users/octocat',
      html_url: 'https://github.com/octocat',
      followers_url: 'https://api.github.com/users/octocat/followers',
      following_url: 'https://api.github.com/users/octocat/following{/other_user}',
      gists_url: 'https://api.github.com/users/octocat/gists{/gist_id}',
      starred_url: 'https://api.github.com/users/octocat/starred{/owner}{/repo}',
      subscriptions_url: 'https://api.github.com/users/octocat/subscriptions',
      organizations_url: 'https://api.github.com/users/octocat/orgs',
      repos_url: 'https://api.github.com/users/octocat/repos',
      events_url: 'https://api.github.com/users/octocat/events{/privacy}',
      received_events_url: 'https://api.github.com/users/octocat/received_events',
      type: 'User',
      site_admin: false
    },
    created_at: `${date.toISOString()}`,
    updated_at: `${date.toISOString()}`
  }
}

function createColumnJson(id: number, name: string, projectId: number, date: Date) {
  return {
    url: `https://api.github.com/projects/columns/${id}`,
    project_url: `https://api.github.com/projects/${projectId}`,
    cards_url: `https://api.github.com/projects/columns/${id}/cards`,
    id: id,
    node_id: 'unused',
    name: 'foo',
    created_at: `${date.toISOString}`,
    updated_at: `${date.toISOString}`
  }
}

function createIssueJson(
  id: number,
  title: string,
  body: string,
  date: Date,
  assignee?: string,
  state: 'open' | 'closed' = 'open'
) {
  const json = {
    id: 1,
    node_id: 'unused',
    url: `https://api.github.com/repos/my-org/my-repo/issues/${id}`,
    repository_url: 'https://api.github.com/repos/my-org/my-repo',
    labels_url: `https://api.github.com/repos/my-org/my-repo/issues/${id}/labels{/name}`,
    comments_url: `https://api.github.com/repos/my-org/my-repo/issues/${id}/comments`,
    events_url: `https://api.github.com/repos/my-org/my-repo/issues/${id}/events`,
    html_url: `https://github.com/my-org/my-repo/issues/${id}`,
    number: id,
    state: state,
    title: title,
    body: body,
    user: {
      login: 'octocat',
      id: 1,
      node_id: 'unused',
      avatar_url: 'https://github.com/images/error/octocat_happy.gif',
      gravatar_id: '',
      url: 'https://api.github.com/users/octocat',
      html_url: 'https://github.com/octocat',
      followers_url: 'https://api.github.com/users/octocat/followers',
      following_url: 'https://api.github.com/users/octocat/following{/other_user}',
      gists_url: 'https://api.github.com/users/octocat/gists{/gist_id}',
      starred_url: 'https://api.github.com/users/octocat/starred{/owner}{/repo}',
      subscriptions_url: 'https://api.github.com/users/octocat/subscriptions',
      organizations_url: 'https://api.github.com/users/octocat/orgs',
      repos_url: 'https://api.github.com/users/octocat/repos',
      events_url: 'https://api.github.com/users/octocat/events{/privacy}',
      received_events_url: 'https://api.github.com/users/octocat/received_events',
      type: 'User',
      site_admin: false
    },
    labels: [
      {
        id: 208045946,
        node_id: 'unused',
        url: 'https://api.github.com/repos/my-org/my-repo/labels/retrobot',
        name: 'retrobot',
        description: 'Created by retrobot!',
        color: 'f29513',
        default: true
      }
    ],
    locked: true,
    active_lock_reason: 'too heated',
    comments: 0,
    pull_request: {
      url: `https://api.github.com/repos/my-org/my-repo/pulls/${id}`,
      html_url: `https://github.com/my-org/my-repo/pull/${id}`,
      diff_url: `https://github.com/my-org/my-repo/pull/${id}.diff`,
      patch_url: `https://github.com/my-org/my-repo/pull/${id}.patch`
    },
    closed_at: null,
    created_at: date.toISOString(),
    updated_at: date.toISOString(),
    closed_by: null
  } as any

  if (assignee) {
    json['assignee'] = {
      login: 'octocat',
      id: 1,
      node_id: 'unused',
      avatar_url: 'https://github.com/images/error/octocat_happy.gif',
      gravatar_id: '',
      url: 'https://api.github.com/users/octocat',
      html_url: 'https://github.com/octocat',
      followers_url: 'https://api.github.com/users/octocat/followers',
      following_url: 'https://api.github.com/users/octocat/following{/other_user}',
      gists_url: 'https://api.github.com/users/octocat/gists{/gist_id}',
      starred_url: 'https://api.github.com/users/octocat/starred{/owner}{/repo}',
      subscriptions_url: 'https://api.github.com/users/octocat/subscriptions',
      organizations_url: 'https://api.github.com/users/octocat/orgs',
      repos_url: 'https://api.github.com/users/octocat/repos',
      events_url: 'https://api.github.com/users/octocat/events{/privacy}',
      received_events_url: 'https://api.github.com/users/octocat/received_events',
      type: 'User',
      site_admin: false
    }

    json['assignees'] = [
      {
        login: 'octocat',
        id: 1,
        node_id: 'unused',
        avatar_url: 'https://github.com/images/error/octocat_happy.gif',
        gravatar_id: '',
        url: 'https://api.github.com/users/octocat',
        html_url: 'https://github.com/octocat',
        followers_url: 'https://api.github.com/users/octocat/followers',
        following_url: 'https://api.github.com/users/octocat/following{/other_user}',
        gists_url: 'https://api.github.com/users/octocat/gists{/gist_id}',
        starred_url: 'https://api.github.com/users/octocat/starred{/owner}{/repo}',
        subscriptions_url: 'https://api.github.com/users/octocat/subscriptions',
        organizations_url: 'https://api.github.com/users/octocat/orgs',
        repos_url: 'https://api.github.com/users/octocat/repos',
        events_url: 'https://api.github.com/users/octocat/events{/privacy}',
        received_events_url: 'https://api.github.com/users/octocat/received_events',
        type: 'User',
        site_admin: false
      }
    ]

    if (state === 'closed') {
      json['closed_on'] = new Date()
      json['closed_by'] = {
        login: 'octocat',
        id: 1,
        node_id: 'unused',
        avatar_url: 'https://github.com/images/error/octocat_happy.gif',
        gravatar_id: '',
        url: 'https://api.github.com/users/octocat',
        html_url: 'https://github.com/octocat',
        followers_url: 'https://api.github.com/users/octocat/followers',
        following_url: 'https://api.github.com/users/octocat/following{/other_user}',
        gists_url: 'https://api.github.com/users/octocat/gists{/gist_id}',
        starred_url: 'https://api.github.com/users/octocat/starred{/owner}{/repo}',
        subscriptions_url: 'https://api.github.com/users/octocat/subscriptions',
        organizations_url: 'https://api.github.com/users/octocat/orgs',
        repos_url: 'https://api.github.com/users/octocat/repos',
        events_url: 'https://api.github.com/users/octocat/events{/privacy}',
        received_events_url: 'https://api.github.com/users/octocat/received_events',
        type: 'User',
        site_admin: false
      }
    }
  }

  return json
}

beforeAll(async () => {
  process.env['GITHUB_REPOSITORY'] = 'my-org/my-repo'
})

describe('test populateColumns', () => {
  const projectId = 17
  const client = new github.GitHub('fakeToken')

  test('add no columns', async () => {
    const scope = nock('https://api.github.com')

    const result = await populateColumns(client, projectId, [], false)
    expect(result).toStrictEqual({})
    scope.done()
  })

  test('add column', async () => {
    const scope = nock('https://api.github.com')
      .post(`/projects/${projectId}/columns`, {name: 'foo'})
      .reply(200, createColumnJson(367, 'foo', projectId, new Date()))

    const result = await populateColumns(client, projectId, ['foo'], false)
    expect(result).toStrictEqual({foo: 367})
    scope.done()
  })

  test('only log', async () => {
    const scope = nock('https://api.github.com')

    const result = await populateColumns(client, projectId, ['foo'], true)
    expect(result).toStrictEqual({})
    scope.done()
  })
})

describe('test populateCards', () => {
  const client = new github.GitHub('fakeToken')

  test('add no cards', async () => {
    const scope = nock('https://api.github.com')

    await populateCards(client, '', {}, {}, false)
    scope.done()
  })

  test('only log', async () => {
    const scope = nock('https://api.github.com')

    await populateCards(client, 'foo => column1\nbar => column2', {}, {column1: 1, column2: 2}, true)
    scope.done()
  })

  test('add cards', async () => {
    const scope = nock('https://api.github.com')
      .post('/projects/columns/1/cards', {note: 'foo'})
      .reply(200)
      .post('/projects/columns/2/cards', {note: 'bar'})
      .reply(200)

    await populateCards(client, 'foo => column1\nbar => column2', {}, {column1: 1, column2: 2}, false)
    scope.done()
  })

  test('ignore cards with no text', async () => {
    const scope = nock('https://api.github.com')

    await populateCards(client, ' => column1', {}, {column1: 1}, false)
    scope.done()
  })

  test('ignore cards with no matching column', async () => {
    const scope = nock('https://api.github.com')

    await populateCards(client, ' => column2', {}, {column1: 1}, false)
    scope.done()
  })

  test('rendered text', async () => {
    const scope = nock('https://api.github.com').post('/projects/columns/1/cards', {note: 'foo'}).reply(200)

    await populateCards(client, '{{ text }} => column1', {text: 'foo'}, {column1: 1}, false)
    scope.done()
  })
})

describe('test findLatestRetro', () => {
  const client = new github.GitHub('fakeToken')

  test('non-retrobot project', async () => {
    const scope = nock('https://api.github.com')
      .get(`/repos/my-org/my-repo/projects?state=all`)
      .reply(200, [createProjectJson(1, 'my-project', 'Non-retrobot project', new Date())])

    const result = await findLatestRetro(client, 'Test Team')
    expect(result).toBeUndefined()
    scope.done()
  })

  test('retrobot project', async () => {
    const scope = nock('https://api.github.com')
      .get(`/repos/my-org/my-repo/projects?state=all`)
      .reply(200, [createProjectJson(1, 'my-project', 'Retrobot: {"team":"Test Team"}', new Date())])

    const result = await findLatestRetro(client, 'Test Team')
    expect(result).toBeDefined()
    scope.done()
  })

  test('retrobot project from different team', async () => {
    const scope = nock('https://api.github.com')
      .get(`/repos/my-org/my-repo/projects?state=all`)
      .reply(200, [createProjectJson(1, 'my-project', 'Retrobot: {"team":"Other Team"}', new Date())])

    const result = await findLatestRetro(client, 'Test Team')
    expect(result).toBeUndefined()
    scope.done()
  })

  test('retrobot project with no team matches no team', async () => {
    const date1 = new Date('2020-09-19')
    const date2 = new Date('2020-09-20')

    const scope = nock('https://api.github.com')
      .get(`/repos/my-org/my-repo/projects?state=all`)
      .reply(200, [
        createProjectJson(1, 'my-project', 'Retrobot: {"team":""}', date1),
        createProjectJson(2, 'my-project', 'Retrobot: {"team":"Test Team"}', date2)
      ])

    const result = await findLatestRetro(client, '')
    expect(result).toBeDefined()
    expect(result?.projectId).toBe(1)
    scope.done()
  })

  test('pick most recent project', async () => {
    const date1 = new Date('2020-09-19')
    const date2 = new Date('2020-09-20')

    const scope = nock('https://api.github.com')
      .get(`/repos/my-org/my-repo/projects?state=all`)
      .reply(200, [
        createProjectJson(1, 'my-project', `Retrobot: {"team":"Test Team", "date":"${date1}"}`, date1),
        createProjectJson(2, 'my-project', `Retrobot: {"team":"Test Team", "date":"${date2}"}`, date2)
      ])

    const result = await findLatestRetro(client, 'Test Team')
    expect(result).toBeDefined()
    expect(result?.projectId).toBe(2)
    scope.done()
  })

  test('filter before', async () => {
    const date1 = new Date('2020-09-19')
    const date2 = new Date('2020-09-20')

    const scope = nock('https://api.github.com')
      .get(`/repos/my-org/my-repo/projects?state=all`)
      .reply(200, [
        createProjectJson(1, 'my-project', `Retrobot: {"team":"Test Team", "date":"${date1}"}`, date1),
        createProjectJson(2, 'my-project', `Retrobot: {"team":"Test Team", "date":"${date2}"}`, date2)
      ])

    const result = await findLatestRetro(client, 'Test Team', date2)
    expect(result).toBeDefined()
    expect(result?.projectId).toBe(1)
    scope.done()
  })
})

describe('test createIssue', () => {
  const client = new github.GitHub('fakeToken')

  test('create issue', async () => {
    const scope = nock('https://api.github.com')
      .post('/repos/my-org/my-repo/issues', {title: 'Test Issue', body: 'Issue Body', labels: ['retrobot']})
      .reply(201, createIssueJson(1347, 'Test Issue', 'Issue Body', new Date()))
      .post('/repos/my-org/my-repo/issues/1347/assignees', {assignees: ['octocat']})
      .reply(201, createIssueJson(1347, 'Test Issue', 'Issue Body', new Date(), 'octocat'))

    const result = await createIssue(
      client,
      'Test Issue',
      {
        team: 'Test Team',
        date: new Date(),
        driver: 'octocat',
        offset: 0,
        issue: undefined
      },
      'Issue Body',
      {},
      false
    )

    expect(result).toStrictEqual({id: 1347, url: 'https://github.com/my-org/my-repo/issues/1347'})
    scope.done()
  })

  test('rendered text', async () => {
    const scope = nock('https://api.github.com')
      .post('/repos/my-org/my-repo/issues', {title: 'Test Issue', body: 'foo', labels: ['retrobot']})
      .reply(201, createIssueJson(1347, 'Test Issue', 'foo', new Date()))
      .post('/repos/my-org/my-repo/issues/1347/assignees', {assignees: ['octocat']})
      .reply(201, createIssueJson(1347, 'Test Issue', 'foo', new Date(), 'octocat'))

    const result = await createIssue(
      client,
      'Test Issue',
      {
        team: 'Test Team',
        date: new Date(),
        driver: 'octocat',
        offset: 0,
        issue: undefined
      },
      '{{ text }}',
      {text: 'foo'},
      false
    )

    expect(result).toStrictEqual({id: 1347, url: 'https://github.com/my-org/my-repo/issues/1347'})
    scope.done()
  })

  test('only log', async () => {
    const scope = nock('https://api.github.com')

    const result = await createIssue(
      client,
      'Test Issue',
      {
        team: 'Test Team',
        date: new Date(),
        driver: 'octocat',
        offset: 0,
        issue: undefined
      },
      'Issue Body',
      {},
      true
    )

    expect(result).toStrictEqual({id: 0, url: ''})
    scope.done()
  })
})

describe('test closeIssue', () => {
  const client = new github.GitHub('fakeToken')

  test('close issue', async () => {
    const scope = nock('https://api.github.com')
      .get('/repos/my-org/my-repo/issues/1347')
      .reply(200, createIssueJson(1347, 'Test Issue', 'Issue Body', new Date(), 'octocat'))
      .patch('/repos/my-org/my-repo/issues/1347')
      .reply(200, createIssueJson(1347, 'Test Issue', 'Issue Body', new Date(), 'octocat', 'closed'))

    await closeIssue(client, 1347, false)
    scope.done()
  })

  test('no-op on closed issue', async () => {
    const scope = nock('https://api.github.com')
      .get('/repos/my-org/my-repo/issues/1347')
      .reply(200, createIssueJson(1347, 'Test Issue', 'Issue Body', new Date(), 'octocat', 'closed'))

    await closeIssue(client, 1347, false)
    scope.done()
  })

  test('only log', async () => {
    const scope = nock('https://api.github.com')
      .get('/repos/my-org/my-repo/issues/1347')
      .reply(200, createIssueJson(1347, 'Test Issue', 'Issue Body', new Date(), 'octocat'))

    await closeIssue(client, 1347, true)
    scope.done()
  })
})

describe('test toProjectDescription and parseProjectDescription', () => {
  test('no issue', async () => {
    const info: IRetroInfo = {
      date: new Date(),
      team: 'Test Team',
      driver: 'alice',
      offset: 2,
      issue: undefined
    }

    const str = toProjectDescription(info)
    const result = parseProjectDescription(str)

    expect(result).toStrictEqual(info)
  })

  test('no team', async () => {
    const info: IRetroInfo = {
      date: new Date(),
      team: '',
      driver: 'alice',
      offset: 2,
      issue: undefined
    }

    const str = toProjectDescription(info)
    const result = parseProjectDescription(str)

    expect(result).toStrictEqual(info)
  })

  test('all info', async () => {
    const info: IRetroInfo = {
      date: new Date(),
      team: 'Test Team',
      driver: 'alice',
      offset: 2,
      issue: 5
    }

    const str = toProjectDescription(info)
    const result = parseProjectDescription(str)

    expect(result).toStrictEqual(info)
  })
})

describe('test sendNotification', () => {
  test('send notification', async () => {
    const scope = nock('https://hooks.slack.com')
      .post('/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX', {
        username: 'Retrobot',
        text: 'Test Notification',
        icon_emoji: defaultNotificationEmoji,
        link_names: true
      })
      .reply(200)

    await sendNotification(
      'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
      'Test Notification',
      {},
      false
    )
    scope.done()
  })

  test('rendered text', async () => {
    const scope = nock('https://hooks.slack.com')
      .post('/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX', {
        username: 'Retrobot',
        text: 'foo',
        icon_emoji: defaultNotificationEmoji,
        link_names: true
      })
      .reply(200)

    await sendNotification(
      'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
      '{{ text }}',
      {text: 'foo'},
      false
    )
    scope.done()
  })

  test('only log', async () => {
    const scope = nock('https://api.github.com')

    await sendNotification(
      'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
      'Test Notification',
      {},
      true
    )
    scope.done()
  })
})
