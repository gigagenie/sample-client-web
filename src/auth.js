/*
 * Copyright 2020 KT AI Lab.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

// --------------------------------------------------
// auth.js
// --------------------------------------------------
import { timestamp } from './util.js';

export async function authorize(server, client) {
    console.log(`[auth] authorize client=${JSON.stringify(client)}`);
    const time = timestamp();

    try {
        const response = await fetch('https://' + server + '/v2/authorize', {
            method: 'POST', 
            headers: {
                'x-auth-clienttype': 'GINSIDE',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                'client_key': client.key,
                'timestamp': time,
                'signature': libcrypto.createHmac('sha256', client.secret).update(`${client.id}:${client.key}:${time}`).digest('hex'),
                'userid': client.userid,
                'devicemodel': 'sample-cli-web',
            })
        });
        return await response.json();
    } catch(e) {
        console.error(`[auth] authorize error. e=${e}`);
        return { rc: e };
    }
}

export async function deauthorize(server, client) {
    console.log(`[auth] deauthorize client=${JSON.stringify(client)}`);
    const time = timestamp();

    try {
        const response = await fetch('https://' + server + '/v2/authorize/' + client.uuid, {
            method: 'DELETE', 
            headers: {
                'x-auth-clienttype': 'GINSIDE',
                'x-auth-timestamp': time,
                'x-auth-signature': libcrypto.createHmac('sha256', client.secret).update(`${client.id}:${client.key}:${time}`).digest('hex')
            }
        });
        return await response.json();
    } catch(e) {
        console.error(`[auth] deauthorize error. e=${e}`);
        return { rc: e };
    }
}

