"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotification = exports.closeIssue = exports.createIssue = exports.populateCards = exports.populateColumns = exports.updateBoardDescription = exports.createBoard = exports.closeBoard = exports.findLatestRetro = exports.parseProjectDescription = exports.toProjectDescription = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const axios_1 = __importDefault(require("axios"));
const mustache = __importStar(require("mustache"));
const defaults_1 = require("./defaults");
/**
 * Prefix used in the project board description to identify projects created
 * by this code.
 */
const bodyPrefix = 'Retrobot: ';
/**
 * Encodes an IRetroInfo object into a string that can be stored in the
 * project board description or elsewhere.
 *
 * @param info the IRetroInfo object to encode
 */
function toProjectDescription(info) {
    return bodyPrefix + JSON.stringify(info);
}
exports.toProjectDescription = toProjectDescription;
/**
 * Parses a string containing an encoded IRetroInfo object that was produced
 * by {@link toProjectDescription}.
 *
 * @param info the string representation
 * @returns the parsed IRetroInfo object
 */
function parseProjectDescription(info) {
    if (info.startsWith(bodyPrefix)) {
        const content = JSON.parse(info.substring(bodyPrefix.length));
        return {
            team: content['team'],
            date: new Date(content['date']),
            driver: content['driver'],
            offset: parseInt(content['offset']),
            issue: content['issue'] ? parseInt(content['issue']) : undefined
        };
    }
    else {
        throw Error(`not a valid retro body: ${info}`);
    }
}
exports.parseProjectDescription = parseProjectDescription;
/**
 * Finds the last retro.
 *
 * @param client the GitHub client
 * @param teamName the team name, or '' if not defined
 * @param before if specified, finds the last retro before the given date
 * @returns information about the last retro, or undefined if no matching retro found
 */
async function findLatestRetro(client, teamName, before) {
    core.info('Locating the last retro...');
    const parseRetro = (proj) => {
        const info = parseProjectDescription(proj.body);
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
        };
    };
    const retros = [];
    for await (const result of client.paginate.iterator(client.projects.listForRepo.endpoint.merge({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        state: 'all'
    }))) {
        const response = result.data;
        if (response) {
            core.info(`Loading page containing ${response.length} projects`);
            for (const retro of response.filter(proj => proj.body.startsWith(bodyPrefix)).map(proj => parseRetro(proj))) {
                retros.push(retro);
            }
        }
        else {
            core.error(`Unexpected response: ${result}`);
        }
    }
    const sorted = retros
        .filter(retro => (teamName ? teamName === retro.team : !retro.team))
        .filter(retro => (before ? retro.date < before : true))
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .reverse();
    core.info(`Found ${sorted.length} retro projects for this repo`);
    return sorted.length > 0 ? sorted[0] : undefined;
}
exports.findLatestRetro = findLatestRetro;
/**
 * Closes the last retro board.
 *
 * @param client the GitHub client
 * @param retro the retro to close
 */
async function closeBoard(client, retro, onlyLog) {
    if (!onlyLog) {
        await client.projects.update({
            project_id: retro.projectId,
            state: 'closed'
        });
    }
}
exports.closeBoard = closeBoard;
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
async function createBoard(client, title, retroInfo, columnNames, cards, view, onlyLog) {
    let projectId = 0;
    let projectUrl = '';
    if (!onlyLog) {
        const project = await client.projects.createForRepo({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            name: title,
            body: toProjectDescription(retroInfo)
        });
        projectId = project.data.id;
        projectUrl = project.data.html_url;
    }
    if (!columnNames.length) {
        columnNames = defaults_1.defaultColumnNames;
    }
    const columnMap = await populateColumns(client, projectId, columnNames, onlyLog);
    if (cards) {
        await populateCards(client, cards, view, columnMap, onlyLog);
    }
    return {
        id: projectId,
        url: projectUrl
    };
}
exports.createBoard = createBoard;
/**
 * Updates the JSON string stored in the project board description.
 *
 * @param client the GitHub client
 * @param projectId the project board id
 * @param retroInfo the new information to store
 * @param onlyLog if true, will not update the project board
 */
async function updateBoardDescription(client, projectId, retroInfo, onlyLog) {
    if (!onlyLog) {
        await client.projects.update({
            project_id: projectId,
            body: toProjectDescription(retroInfo)
        });
    }
    core.info(`Updated description of project board ${projectId}`);
}
exports.updateBoardDescription = updateBoardDescription;
/**
 * Populates the columns on the project board.
 *
 * @param client the GitHub client
 * @param projectId the project board id
 * @param columnNames the names of the columns
 * @param onlyLog if true, will not add any columns to the board
 */
async function populateColumns(client, projectId, columnNames, onlyLog) {
    const columnMap = {};
    for (const name of columnNames) {
        core.info(`Creating column '${name}'`);
        if (!onlyLog) {
            const column = await client.projects.createColumn({
                project_id: projectId,
                name
            });
            columnMap[name] = column.data.id;
        }
    }
    return columnMap;
}
exports.populateColumns = populateColumns;
/**
 * Populates any custom cards on the project board.
 *
 * @param client the GitHub client
 * @param cards formatted string specifying the cards to generate
 * @param view the view for rendering mustache templates
 * @param columnMap map of column names to ids
 * @param onlyLog if true, will not add any cards to the project board
 */
async function populateCards(client, cards, view, columnMap, onlyLog) {
    if (!cards) {
        core.info('No cards to render');
        return;
    }
    for (const card of cards
        .split('\n')
        .map(c => c.trim())
        .reverse()) {
        const parts = card.split('=>').map(p => p.trim());
        const text = mustache.render(parts[0], view);
        const column = parts[1];
        if (text) {
            core.info(`Adding card '${text}' to column '${column}'`);
            if (!onlyLog) {
                const columnId = columnMap[column];
                if (columnId) {
                    await client.projects.createCard({
                        column_id: columnId,
                        note: text
                    });
                }
                else {
                    core.info(`Card not rendered, no matching column: ${column}`);
                }
            }
        }
        else {
            core.info(`Card not rendered, text is empty: ${parts[0]}`);
        }
    }
}
exports.populateCards = populateCards;
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
async function createIssue(client, title, retro, template, view, onlyLog) {
    let issueNumber = 0;
    let issueUrl = '';
    if (!onlyLog) {
        const issue = await client.issues.create({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            title,
            body: mustache.render(template, view),
            labels: ['retrobot']
        });
        await client.issues.addAssignees({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: issue.data.number,
            assignees: [retro.driver]
        });
        issueNumber = issue.data.number;
        issueUrl = issue.data.html_url;
    }
    return {
        id: issueNumber,
        url: issueUrl
    };
}
exports.createIssue = createIssue;
/**
 * Close the issue.
 *
 * @param client the GitHub client
 * @param issueNumber the issue number to close
 * @param onlyLog if true, will not close the issue
 */
async function closeIssue(client, issueNumber, onlyLog) {
    try {
        const res = await client.issues.get({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: issueNumber
        });
        if (res.data.state === 'open') {
            if (!onlyLog) {
                await client.issues.update({
                    owner: github.context.repo.owner,
                    repo: github.context.repo.repo,
                    issue_number: issueNumber,
                    state: 'closed'
                });
            }
            core.info(`Closed issue ${res.data.html_url}`);
        }
        else {
            core.info(`Issue ${res.data.html_url} is already closed`);
        }
    }
    catch (error) {
        core.info(`Failed to get issue: ${error}`);
    }
}
exports.closeIssue = closeIssue;
/**
 * Sends a slack notification announcing a retro is scheduled for today.
 *
 * @param notificationUrl the incoming webhooks notification url
 * @param notificationTemplate the mustache template used to generate the notification text
 * @param view view for rendering the mustache template
 * @param onlyLog if true, will not issue the notification
 */
async function sendNotification(notificationUrl, notificationTemplate, view, onlyLog) {
    if (!onlyLog) {
        const body = {
            username: 'Retrobot',
            text: mustache.render(notificationTemplate, view),
            icon_emoji: defaults_1.defaultNotificationEmoji,
            link_names: true
        };
        const res = await axios_1.default.post(notificationUrl, body);
        core.info(res.statusText);
    }
}
exports.sendNotification = sendNotification;
