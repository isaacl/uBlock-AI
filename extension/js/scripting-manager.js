/*******************************************************************************

    uBlock Origin Lite - a comprehensive, MV3-compliant content blocker
    Copyright (C) 2022-present Raymond Hill

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see {http://www.gnu.org/licenses/}.

    Home: https://github.com/gorhill/uBlock
*/

import {
    browser,
    sessionKeys, sessionRemove,
} from './ext.js';
import { ubolErr, ubolLog } from './debug.js';

import { registerCustomFilters } from './filter-manager.js';

/******************************************************************************/

async function resetCSSCache() {
    const keys = await sessionKeys();
    return sessionRemove(keys.filter(a => a.startsWith('cache.css.')));
}

/******************************************************************************/

export async function registerInjectables() {
    if ( browser.scripting === undefined ) { return false; }

    if ( registerInjectables.barrier ) { return true; }
    registerInjectables.barrier = true;

    const toAdd = [];
    const context = { toAdd };

    await registerCustomFilters(context);

    ubolLog(`Unregistered all content (css/js)`);
    try {
        await browser.scripting.unregisterContentScripts();
    } catch(reason) {
        ubolErr(`unregisterContentScripts/${reason}`);
    }

    if ( toAdd.length !== 0 ) {
        ubolLog(`Registered ${toAdd.map(v => v.id)} content (css/js)`);
        try {
            await browser.scripting.registerContentScripts(toAdd);
        } catch(reason) {
            ubolErr(`registerContentScripts/${reason}`);
        }
    }

    await resetCSSCache();

    registerInjectables.barrier = false;

    return true;
}

/******************************************************************************/

export async function getRegisteredContentScripts() {
    const scripts = await browser.scripting.getRegisteredContentScripts()
        .catch(( ) => []);
    return scripts.map(a => a.id);
}

/******************************************************************************/

export async function onWakeupRun() {
    // No-op: wakeup handling is simplified since there are no rulesets to refresh
}

/******************************************************************************/
