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

export function timestamp() {
    const pad2 = (n) => {
        return (n < 10 ? '0' : '') + n;
    };

    const now = new Date();
    return now.getFullYear() + 
            pad2(now.getMonth() +1) +
            pad2(now.getDate()) +
            pad2(now.getHours()) + 
            pad2(now.getMinutes()) +
            pad2(now.getSeconds()) +
            pad2(now.getMilliseconds());
}

