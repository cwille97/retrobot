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
exports.nextDate = exports.newDate = exports.nextDriver = exports.tryCreateRetro = void 0;
const core = __importStar(require("@actions/core"));
const mustache = __importStar(require("mustache"));
const date_format_1 = __importDefault(require("date-format"));
const api_1 = require("./api");
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
