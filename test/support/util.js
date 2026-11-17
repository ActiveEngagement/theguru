import '../../src/core/tap.js';
import path from 'path';
import { readFile } from '../../src/core/fs_util.js';

/**
 * Shortcut for reading a test resource.
 */
export function resource(filePath) {
    return readFile(testUrl(path.join('resources', filePath)));
}

export function apiCall(type, body) {
    return {
        type,
        options: {
            headers: {
                accept: 'application/json',
                authorization: 'Basic ' + Buffer.from('undefined:undefined').toString('base64'),
                'content-type': 'application/json'
            }
        }
    }.tap(call => {
        if(body) {
            call.options.body = body;
        }
    });
}

export function createCardApiCall(options) {
    options.attachments ||= [];
    return apiCall('createCard', {
        shareStatus: 'TEAM',
        ...options
    });
}

export function updateCardApiCall(id, options) {
    options.attachments ||= [];
    const call = apiCall('updateCard', options);
    call.id = id;

    return call;
}

/**
 * Resolves a path from the `test` directory.
 */

export function testUrl(filePath) {
    // `import.meta.url` is the directory of the current script. Since `util.js` is under `test/support`, one directory
    // up from the current one will be the test directory.
    return new URL(filePath, path.dirname(import.meta.url));
}