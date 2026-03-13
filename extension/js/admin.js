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
    adminRead,
    localRead, localRemove, localWrite,
    sessionRead, sessionWrite,
} from './ext.js';

/******************************************************************************/

export async function adminReadEx(key) {
    let cacheValue;
    const session = await sessionRead(`admin.${key}`);
    if ( session ) {
        cacheValue = session.data;
    } else {
        const local = await localRead(`admin.${key}`);
        if ( local ) {
            cacheValue = local.data;
        }
        localRemove(`admin_${key}`);
    }
    adminRead(key).then(async value => {
        const adminKey = `admin.${key}`;
        await Promise.all([
            sessionWrite(adminKey, { data: value }),
            localWrite(adminKey, { data: value }),
        ]);
    });
    return cacheValue;
}

/******************************************************************************/
