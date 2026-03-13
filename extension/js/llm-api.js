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

/******************************************************************************/

// Consistent LLM API for the service worker.
// Supports OpenAI and Google (Gemini) models via fetch.

/******************************************************************************/

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const GOOGLE_GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/******************************************************************************/

// Available models per provider.

export const LLM_PROVIDERS = {
    openai: {
        name: 'OpenAI',
        models: [
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
            { id: 'gpt-4o', name: 'GPT-4o' },
            { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
            { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
        ],
    },
    google: {
        name: 'Google',
        models: [
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
            { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash' },
        ],
    },
};

/******************************************************************************/

async function queryOpenAI(apiKey, model, systemPrompt, userPrompt) {
    const response = await fetch(OPENAI_CHAT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.2,
        }),
    });
    if ( response.ok !== true ) {
        const error = await response.text();
        throw new Error(`OpenAI API error ${response.status}: ${error}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
}

/******************************************************************************/

async function queryGoogle(apiKey, model, systemPrompt, userPrompt) {
    const url = `${GOOGLE_GEMINI_URL}/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            system_instruction: {
                parts: [{ text: systemPrompt }],
            },
            contents: [{
                parts: [{ text: userPrompt }],
            }],
            generationConfig: {
                temperature: 0.2,
            },
        }),
    });
    if ( response.ok !== true ) {
        const error = await response.text();
        throw new Error(`Google API error ${response.status}: ${error}`);
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

/******************************************************************************/

// Unified query function.
// provider: 'openai' | 'google'

export async function queryLLM(provider, model, apiKey, systemPrompt, userPrompt) {
    if ( typeof apiKey !== 'string' || apiKey === '' ) {
        throw new Error('API key is not configured');
    }
    switch ( provider ) {
    case 'openai':
        return queryOpenAI(apiKey, model, systemPrompt, userPrompt);
    case 'google':
        return queryGoogle(apiKey, model, systemPrompt, userPrompt);
    default:
        throw new Error(`Unknown LLM provider: ${provider}`);
    }
}

/******************************************************************************/

// Parse the LLM response JSON. Tolerant of markdown fences.

export function parseLLMResponse(raw) {
    let text = raw.trim();
    // Strip markdown code fences if present
    if ( text.startsWith('```') ) {
        text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    try {
        const arr = JSON.parse(text);
        if ( Array.isArray(arr) === false ) { return []; }
        return arr.filter(item =>
            typeof item.selector === 'string' &&
            item.selector !== ''
        );
    } catch {
        return [];
    }
}

/******************************************************************************/
