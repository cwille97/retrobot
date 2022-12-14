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
define("types", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
});
define("defaults", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.defaultColumnNames = exports.defaultNotificationEmoji = exports.defaultNotificationTemplate = exports.defaultIssueTemplate = exports.defaultTitleTemplate = void 0;
    exports.defaultTitleTemplate = '{{{ team }}} Retro on {{{ date }}}';
    exports.defaultIssueTemplate = `Hey {{ driver }},
      
You are scheduled to drive the next retro on {{ date }}. The retro board has been created at {{{ url }}}. Please remind the team beforehand to fill out their cards.

Need help? Found a bug? Visit https://github.com/dhadka/retrobot.

Best Regards,

Retrobot`;
    exports.defaultNotificationTemplate = '<!here|here> A retro is scheduled for today! Visit <{{{ url }}}|the retro board> to add your cards. CC retro driver @{{ driver }}';
    exports.defaultNotificationEmoji = ':rocket:';
    exports.defaultColumnNames = ['Went well', 'Went meh', 'Could have gone better', 'Action items!'];
});
define("api", ["require", "exports", "@actions/core", "@actions/github", "axios", "mustache", "defaults"], function (require, exports, core, github, axios_1, mustache, defaults_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.sendNotification = exports.closeIssue = exports.createIssue = exports.populateCards = exports.populateColumns = exports.updateBoardDescription = exports.createBoard = exports.closeBoard = exports.findLatestRetro = exports.parseProjectDescription = exports.toProjectDescription = void 0;
    core = __importStar(core);
    github = __importStar(github);
    axios_1 = __importDefault(axios_1);
    mustache = __importStar(mustache);
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
});
define("retro", ["require", "exports", "@actions/core", "mustache", "date-format", "api"], function (require, exports, core, mustache, date_format_1, api_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.nextDate = exports.newDate = exports.nextDriver = exports.tryCreateRetro = void 0;
    core = __importStar(core);
    mustache = __importStar(mustache);
    date_format_1 = __importDefault(date_format_1);
    /**
     * Performs all the functionality to create the retros, including:
     *
     * 1. Determining if the retro already exists and, if necessary, creating a new one.
     * 2. Opening an tracking issue and assigning to the retro driver.
     * 3. Sending a slack notification the day of the retro.
     * 4. Closing old retros.
     *
     * In order to fully utilize all this functionality, this script should be invoked
     * once a day before the scheduled retro time.  For example, if the retro is
     * scheduled on Wednesdays at 2 PM EST, the GitHub Actions workflow could, for example,
     * use:
     *
     * ```
     * on:
     *   schedule:
     *     - cron: '0 14 * * *'
     * ```
     *
     * to run every day at 10 AM EST, which is when any notifications will be sent.  If the
     * workflow is scheduled multiple times a day, multiple notifications may be sent.
     */
    async function tryCreateRetro(client, args) {
        if (!args.handles.length) {
            throw Error('requires at least one handle');
        }
        if (args.onlyLog) {
            core.info('only-log is set, will not make any changes');
        }
        // Close any outdated retros.
        if (args.closeAfterDays > 0) {
            const oldRetro = await (0, api_1.findLatestRetro)(client, args.teamName, newDate(-args.closeAfterDays));
            if (oldRetro && oldRetro.state === 'open') {
                await (0, api_1.closeBoard)(client, oldRetro, args.onlyLog);
                core.info(`Closed old project board from ${oldRetro.date}`);
                if (oldRetro.issue) {
                    await (0, api_1.closeIssue)(client, oldRetro.issue, args.onlyLog);
                    core.info(`Closed old issue referenced by project board`);
                }
            }
        }
        // Locate the last retro.
        const today = newDate(0, true);
        const tomorrow = newDate(1, true);
        const lastRetro = await (0, api_1.findLatestRetro)(client, args.teamName);
        if (lastRetro) {
            core.info(`Last retro scheduled on ${lastRetro.date} with ${lastRetro.driver} driving`);
        }
        // If there is already a scheduled retro in the future.
        if (lastRetro && lastRetro.date > today) {
            if (lastRetro.date < tomorrow) {
                core.info('Retro happening today, sending notification');
                await (0, api_1.sendNotification)(args.notificationUrl, args.notificationTemplate, lastRetro, args.onlyLog);
            }
            return;
        }
        // Otherwise, there was no previous retro or it occurred in the past.
        const lastRetroDate = lastRetro ? lastRetro.date : new Date();
        const lastRetroDriver = lastRetro ? lastRetro.driver : '';
        const lastRetroOffset = lastRetro ? lastRetro.offset : 0;
        const nextRetroDate = nextDate(lastRetroDate, args.retroDayOfWeek, args.retroCadenceInWeeks);
        const nextRetroDriver = nextDriver(args.handles, lastRetroDriver, lastRetroOffset);
        const futureRetroDriver = nextDriver(args.handles, nextRetroDriver);
        core.info(`Next retro scheduled for ${nextRetroDate} with ${nextRetroDriver} driving`);
        // Create the new retro and issue.
        let newRetro = {
            date: nextRetroDate,
            team: args.teamName,
            driver: nextRetroDriver,
            offset: args.handles.indexOf(nextRetroDriver),
            issue: undefined
        };
        const view = createView(newRetro, lastRetro, futureRetroDriver, args);
        const title = createTitle(args.titleTemplate, view);
        view['title'] = title;
        const board = await (0, api_1.createBoard)(client, title, newRetro, args.columns, args.cards, view, args.onlyLog);
        view['url'] = board.url;
        core.info(`Created retro board at ${board.url}`);
        if (args.createTrackingIssue) {
            const issue = await (0, api_1.createIssue)(client, title, newRetro, args.issueTemplate, view, args.onlyLog);
            core.info(`Created tracking issue at ${issue.url}`);
            newRetro = Object.assign({}, newRetro, { issue: issue.id });
            await (0, api_1.updateBoardDescription)(client, board.id, newRetro, args.onlyLog);
        }
    }
    exports.tryCreateRetro = tryCreateRetro;
    /**
     * Determines the next retro driver.  Retro drivers are selected in the order they appear
     * in the list of GitHub handles.
     *
     * @param handles array of GitHub handles
     * @param lastDriver the GitHub handle of the last retro driver, or '' if no previous retros found
     * @param lastOffset the offset of the last retro driver
     */
    function nextDriver(handles, lastDriver, lastOffset = 0) {
        if (lastDriver) {
            let pos = handles.indexOf(lastDriver);
            // If the handle is not found, use the last offset to ensure fairness.
            if (pos < 0) {
                pos = lastOffset - 1;
            }
            return handles[(pos + 1) % handles.length];
        }
        else {
            return handles[0];
        }
    }
    exports.nextDriver = nextDriver;
    /**
     * Creates a new date object.
     *
     * @param offsetDays when set, specifies the number of days to offset from today
     * @param atMidnight when true, the time will be set to midnight
     */
    function newDate(offsetDays = 0, atMidnight = false) {
        const date = new Date();
        date.setDate(date.getDate() + offsetDays);
        if (atMidnight) {
            date.setHours(0, 0, 0, 0);
        }
        return date;
    }
    exports.newDate = newDate;
    /**
     * Returns the date of the next retro.
     *
     * @param lastRetroDate the date of the last retro, or an initial date if no previous retros scheduled
     * @param retroDayOfWeek the day of week to schedule the retro, from 0-7 where 0 is Sunday
     * @param retroCadenceInWeeks the frequency of retros, in weeks
     */
    function nextDate(lastRetroDate, retroDayOfWeek, retroCadenceInWeeks) {
        let date = new Date(lastRetroDate);
        date.setDate(date.getDate() + retroCadenceInWeeks * 7);
        if (date < new Date()) {
            date = new Date();
            date.setDate(date.getDate() + (retroCadenceInWeeks - 1) * 7);
        }
        // adjust day of week if necessary
        const daysToAdd = (7 + retroDayOfWeek - date.getDay()) % 7;
        date.setDate(date.getDate() + daysToAdd);
        return date;
    }
    exports.nextDate = nextDate;
    /**
     * Converts the given date into a human readable string in the specified date format.
     *
     * @param date the date
     */
    function toReadableDate(date, args) {
        return (0, date_format_1.default)(args.dateFormat, date);
    }
    /**
     * Returns the title of the retro.
     *
     * @param template the mustache template for the title
     * @param view the view for rendering the template
     */
    function createTitle(template, view) {
        const result = mustache.render(template, view);
        core.info(`Using title '${result}'`);
        return result;
    }
    /**
     * Generates a view object used to render the Mustache templates.
     *
     * @param retroInfo the current retro info
     * @param lastRetro the last retro
     * @param futureDriver the GitHub handle of the next retro driver
     */
    /* eslint-disable @typescript-eslint/promise-function-async */
    function createView(retroInfo, lastRetro, futureDriver, args) {
        const view = {
            date: toReadableDate(retroInfo.date, args),
            driver: retroInfo.driver,
            team: retroInfo.team,
            'next-driver': futureDriver
        };
        if (lastRetro) {
            view['last-retro'] = {
                title: lastRetro.title,
                date: toReadableDate(lastRetro.date, args),
                driver: lastRetro.driver,
                url: lastRetro.url
            };
        }
        return view;
    }
});
define("utils", ["require", "exports", "@actions/core"], function (require, exports, core) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.parseDayOfWeek = exports.getBoolean = exports.getInt = exports.getString = exports.getList = void 0;
    core = __importStar(core);
    function getList(name, options) {
        const value = getString(name, options);
        if (!value)
            return [];
        return value.split(',').map(l => l.trim());
    }
    exports.getList = getList;
    function getString(name, options) {
        return core.getInput(name, options) || (options?.default ?? '');
    }
    exports.getString = getString;
    function getInt(name, options) {
        const value = parseInt(core.getInput(name, options));
        if (isNaN(value)) {
            return options?.default ?? NaN;
        }
        return value;
    }
    exports.getInt = getInt;
    function getBoolean(name, options) {
        return getString(name, options).toLowerCase() === 'true';
    }
    exports.getBoolean = getBoolean;
    /**
     * Converts a string representation of the day of week to the numeric value.  This accepts partial and
     * complete strings representing the day, such as 'fri' or 'friday', or the numeric day of week, such as '5'.
     */
    function parseDayOfWeek(value) {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        value = value.trim().toLowerCase();
        if (value === '') {
            throw Error('invalid day of week: value is empty');
        }
        else if (value.match(/^\d+$/)) {
            const intValue = parseInt(value);
            if (intValue < 0 || intValue >= 7) {
                throw Error(`invalid day of week: '${value}' is not a valid day of week number, expect 0-6`);
            }
            return intValue;
        }
        else {
            let index = -1;
            for (const day of days) {
                if (day.startsWith(value)) {
                    if (index >= 0) {
                        throw Error(`invalid day of week: matches both ${days[index]} and ${day}`);
                    }
                    index = days.indexOf(day);
                }
            }
            if (index < 0) {
                throw Error(`invalid day of week: '${value}' must match one of ${days.join(', ')}`);
            }
            return index;
        }
    }
    exports.parseDayOfWeek = parseDayOfWeek;
});
define("main", ["require", "exports", "@actions/core", "@actions/github", "retro", "utils", "defaults"], function (require, exports, core, github, retro_1, utils_1, defaults_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    core = __importStar(core);
    github = __importStar(github);
    async function run() {
        core.info('Starting retro creator');
        try {
            const client = new github.GitHub((0, utils_1.getString)('repo-token', { required: true }));
            const args = {
                teamName: (0, utils_1.getString)('team-name'),
                handles: (0, utils_1.getList)('handles', { required: true }),
                retroCadenceInWeeks: (0, utils_1.getInt)('retro-cadence-weeks', { default: 1 }),
                retroDayOfWeek: (0, utils_1.parseDayOfWeek)((0, utils_1.getString)('retro-day-of-week', { default: 'friday' })),
                titleTemplate: (0, utils_1.getString)('title-template', { default: defaults_2.defaultTitleTemplate }),
                notificationUrl: (0, utils_1.getString)('notification-url'),
                notificationTemplate: (0, utils_1.getString)('notification-template', { default: defaults_2.defaultNotificationTemplate }),
                closeAfterDays: (0, utils_1.getInt)('close-after-days', { default: 0 }),
                createTrackingIssue: (0, utils_1.getBoolean)('create-tracking-issue'),
                issueTemplate: (0, utils_1.getString)('issue-template', { default: defaults_2.defaultIssueTemplate }),
                columns: (0, utils_1.getList)('columns'),
                cards: (0, utils_1.getString)('cards'),
                onlyLog: (0, utils_1.getBoolean)('only-log'),
                dateFormat: (0, utils_1.getString)('date-format', { default: 'dd-mm-yyyy' })
            };
            core.info('Arguments parsed. Starting creation.');
            await (0, retro_1.tryCreateRetro)(client, args);
        }
        catch (error) {
            core.setFailed(error.message);
        }
    }
    run();
});
