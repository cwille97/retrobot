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
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const retro_1 = require("./retro");
const utils_1 = require("./utils");
const defaults_1 = require("./defaults");
async function run() {
    core.info('Starting retro creator');
    try {
        const client = new github.GitHub((0, utils_1.getString)('repo-token', { required: true }));
        const args = {
            teamName: (0, utils_1.getString)('team-name'),
            handles: (0, utils_1.getList)('handles', { required: true }),
            retroCadenceInWeeks: (0, utils_1.getInt)('retro-cadence-weeks', { default: 1 }),
            retroDayOfWeek: (0, utils_1.parseDayOfWeek)((0, utils_1.getString)('retro-day-of-week', { default: 'friday' })),
            titleTemplate: (0, utils_1.getString)('title-template', { default: defaults_1.defaultTitleTemplate }),
            notificationUrl: (0, utils_1.getString)('notification-url'),
            notificationTemplate: (0, utils_1.getString)('notification-template', { default: defaults_1.defaultNotificationTemplate }),
            closeAfterDays: (0, utils_1.getInt)('close-after-days', { default: 0 }),
            createTrackingIssue: (0, utils_1.getBoolean)('create-tracking-issue'),
            issueTemplate: (0, utils_1.getString)('issue-template', { default: defaults_1.defaultIssueTemplate }),
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
