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
exports.parseDayOfWeek = exports.getBoolean = exports.getInt = exports.getString = exports.getList = void 0;
const core = __importStar(require("@actions/core"));
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
