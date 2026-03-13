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

import * as scrmgr from './scripting-manager.js';

import {
    addCustomFilters,
    customFiltersFromHostname,
    getAllCustomFilters,
    hasCustomFilters,
    injectCustomFilters,
    removeAllCustomFilters,
    removeCustomFilters,
    startCustomFilters,
    terminateCustomFilters,
} from './filter-manager.js';

import {
    browser,
    localRead, localRemove, localWrite,
    runtime,
    sessionAccessLevel,
    webextFlavor,
} from './ext.js';

import {
    getConsoleOutput,
    ubolErr,
    ubolLog,
} from './debug.js';

import { gotoURL } from './ext-utils.js';
import { toggleToolbarIcon } from './action.js';

/******************************************************************************/

const UBOL_ORIGIN = runtime.getURL('').replace(/\/$/, '').toLowerCase();
const { registerInjectables } = scrmgr;

/******************************************************************************/

function getCurrentVersion() {
    return runtime.getManifest().version;
}

/******************************************************************************/

function onMessage(request, sender, callback) {

    const tabId = sender?.tab?.id ?? false;
    const frameId = tabId && (sender?.frameId ?? false);

    // Does not require trusted origin.

    switch ( request.what ) {

    case 'insertCSS':
        if ( frameId === false ) { return false; }
        // https://bugs.webkit.org/show_bug.cgi?id=262491
        if ( frameId !== 0 && webextFlavor === 'safari' ) { return false; }
        browser.scripting.insertCSS({
            css: request.css,
            origin: 'USER',
            target: { tabId, frameIds: [ frameId ] },
        }).catch(reason => {
            ubolErr(`insertCSS/${reason}`);
        });
        return false;

    case 'removeCSS':
        if ( frameId === false ) { return false; }
        // https://bugs.webkit.org/show_bug.cgi?id=262491
        if ( frameId !== 0 && webextFlavor === 'safari' ) { return false; }
        browser.scripting.removeCSS({
            css: request.css,
            origin: 'USER',
            target: { tabId, frameIds: [ frameId ] },
        }).catch(reason => {
            ubolErr(`removeCSS/${reason}`);
        });
        return false;

    case 'toggleToolbarIcon': {
        if ( tabId ) {
            toggleToolbarIcon(tabId);
        }
        return false;
    }

    case 'startCustomFilters':
        if ( frameId === false ) { return false; }
        startCustomFilters(tabId, frameId).then(( ) => {
            callback();
        });
        return true;

    case 'terminateCustomFilters':
        if ( frameId === false ) { return false; }
        terminateCustomFilters(tabId, frameId).then(( ) => {
            callback();
        });
        return true;

    case 'injectCustomFilters':
        if ( frameId === false ) { return false; }
        injectCustomFilters(tabId, frameId, request.hostname).then(selectors => {
            callback(selectors);
        });
        return true;

    case 'injectCSSProceduralAPI':
        browser.scripting.executeScript({
            files: [ '/js/scripting/css-procedural-api.js' ],
            target: { tabId, frameIds: [ frameId ] },
            injectImmediately: true,
        }).catch(reason => {
            ubolErr(`executeScript/${reason}`);
        }).then(( ) => {
            callback();
        });
        return true;

    default:
        break;
    }

    // Does require trusted origin.

    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/MessageSender
    //   Firefox API does not set `sender.origin`
    if ( sender.origin !== undefined ) {
        if ( sender.origin.toLowerCase() !== UBOL_ORIGIN ) { return; }
    }

    switch ( request.what ) {

    case 'popupPanelData': {
        hasCustomFilters(request.hostname).then(hasCustom => {
            callback({
                hasCustomFilters: hasCustom,
            });
        });
        return true;
    }

    case 'gotoURL':
        gotoURL(request.url, request.type);
        break;

    case 'addCustomFilters':
        addCustomFilters(request.hostname, request.selectors).then(modified => {
            if ( modified !== true ) { return; }
            return registerInjectables();
        }).then(( ) => {
            callback();
        });
        return true;

    case 'removeCustomFilters':
        removeCustomFilters(request.hostname, request.selectors).then(modified => {
            if ( modified !== true ) { return; }
            return registerInjectables();
        }).then(( ) => {
            callback();
        });
        return true;

    case 'removeAllCustomFilters':
        removeAllCustomFilters(request.hostname).then(modified => {
            if ( modified !== true ) { return; }
            return registerInjectables();
        }).then(( ) => {
            callback();
        });
        return true;

    case 'customFiltersFromHostname':
        customFiltersFromHostname(request.hostname).then(selectors => {
            callback(selectors);
        });
        return true;

    case 'getAllCustomFilters':
        getAllCustomFilters().then(data => {
            callback(data);
        });
        return true;

    case 'getRegisteredContentScripts':
        scrmgr.getRegisteredContentScripts().then(ids => {
            callback(ids);
        });
        return true;

    case 'getConsoleOutput':
        callback(getConsoleOutput());
        break;

    case 'getOptionsPageData':
        callback({});
        break;

    default:
        break;
    }

    return false;
}

/******************************************************************************/

function onCommand(command, tab) {
    switch ( command ) {
    case 'enter-zapper-mode': {
        if ( browser.scripting === undefined ) { return; }
        browser.scripting.executeScript({
            files: [ '/js/scripting/tool-overlay.js', '/js/scripting/zapper.js' ],
            target: { tabId: tab.id },
        });
        break;
    }
    case 'enter-picker-mode': {
        if ( browser.scripting === undefined ) { return; }
        browser.scripting.executeScript({
            files: [
                '/js/scripting/css-procedural-api.js',
                '/js/scripting/tool-overlay.js',
                '/js/scripting/picker.js',
            ],
            target: { tabId: tab.id },
        });
        break;
    }
    default:
        break;
    }
}

/******************************************************************************/

async function start() {
    ubolLog(`uBlock Origin Lite ${getCurrentVersion()} starting`);

    // Register custom CSS filters (picker-created selectors)
    const scripts = await scrmgr.getRegisteredContentScripts();
    if ( scripts.length === 0 ) {
        registerInjectables();
    }

    // Cosmetic filtering content scripts cache filtering data in session storage.
    sessionAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
}

/******************************************************************************/

const isFullyInitialized = start().then(( ) => {
    localRemove('goodStart');
    return false;
}).catch(reason => {
    ubolErr(reason);
    return localRead('goodStart').then(goodStart => {
        if ( goodStart === false ) {
            localRemove('goodStart');
            return false;
        }
        return localWrite('goodStart', false).then(( ) => true);
    });
}).then(restart => {
    if ( restart !== true ) { return; }
    runtime.reload();
});

runtime.onMessage.addListener((request, sender, callback) => {
    isFullyInitialized.then(( ) => {
        const r = onMessage(request, sender, callback);
        if ( r !== true ) { callback(); }
    });
    return true;
});

browser.commands.onCommand.addListener((...args) => {
    isFullyInitialized.then(( ) => {
        onCommand(...args);
    });
});
