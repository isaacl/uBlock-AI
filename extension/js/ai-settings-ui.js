/*******************************************************************************

    uBlock Origin Lite - AI-assisted element picker
    Copyright (C) 2025-present

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

*/

import { qs$ } from './dom.js';
import { sendMessage } from './ext.js';

/******************************************************************************/

const providerSelect = qs$('#ai-provider');
const modelSelect = qs$('#ai-model');
const apiKeyInput = qs$('#ai-apikey');
const saveButton = qs$('#ai-save');
const statusDiv = qs$('#ai-status');

let providersData = {};

/******************************************************************************/

function populateModels(provider) {
    const info = providersData[provider];
    if ( info === undefined ) { return; }
    modelSelect.textContent = '';
    for ( const m of info.models ) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        modelSelect.appendChild(opt);
    }
}

/******************************************************************************/

function showStatus(text, isError) {
    statusDiv.textContent = text;
    statusDiv.style.color = isError ? 'var(--info3-ink)' : 'var(--info0-ink)';
    setTimeout(( ) => { statusDiv.textContent = ''; }, 4000);
}

/******************************************************************************/

// Load current settings from service worker.
sendMessage({ what: 'getAISettings' }).then(settings => {
    if ( settings === undefined ) { return; }

    providersData = settings.providers || {};

    // Populate provider dropdown
    providerSelect.textContent = '';
    for ( const [ key, info ] of Object.entries(providersData) ) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = info.name;
        providerSelect.appendChild(opt);
    }

    providerSelect.value = settings.provider;
    populateModels(settings.provider);
    modelSelect.value = settings.model;
    apiKeyInput.value = settings.apiKey;
});

/******************************************************************************/

providerSelect.addEventListener('change', ( ) => {
    populateModels(providerSelect.value);
});

/******************************************************************************/

saveButton.addEventListener('click', ( ) => {
    const provider = providerSelect.value;
    const model = modelSelect.value;
    const apiKey = apiKeyInput.value.trim();

    sendMessage({
        what: 'saveAISettings',
        provider,
        model,
        apiKey,
    }).then(result => {
        if ( result?.ok ) {
            showStatus('Settings saved.', false);
        } else {
            showStatus('Failed to save settings.', true);
        }
    });
});

/******************************************************************************/
