import path from 'path';
import fs from 'fs';
import tmp from 'tmp';
import yaml from 'js-yaml';
import runAction from '../src/core/action.js';
import createClientBase from './support/api_client.js';
import nullColorizer from '../src/gh_action/null_colorizer.js';
import arrayLogger from './support/array_logger.js';
import nullLogger from './support/null_logger.js';
import env from './support/env.js';
import { $ } from 'execa';
import { readFileSync } from '../src/core/fs_util.js';

function createClient(options) {
    options.getCollectionResult ||= { collectionType: 'EXTERNAL' };

    return createClientBase(options);
}

async function action(options) {
    options.logger ||= nullLogger();
    options.colors ||= nullColorizer();
    options.inputs ||= {};
    options.inputs.attachmentHandler ||= 'auto';
    options.inputs.collectionType ||= 'synced';
    options.defaultFooter ||= false;
    options.github ||= {};
    options.github.repo ||= {};
    options.github.repo.url ||= 'https://example.com';
    options.github.repo.name ||= 'ActiveEngagement/test';
    options.github.commit ||= {};
    options.github.commit.sha ||= '1234567890';
    if(options.github.commit.message === undefined) {
        options.github.commit.message = ' ';
    }
    if(options.github.repo.isPublic === undefined) {
        options.github.repo.isPublic = false;
    }

    return await runAction(options);
}

describe('action.js', () => {
    beforeEach(async() => {
        await env({
            some: {
                dir: {
                    'file.md': '# Test\n[test](/assets/test.pdf)',
                    '.info.yml': yaml.dump({ description: 'A Dir', externalUrl: 'https://google.com' })
                }
            },
            assets: {
                'test.pdf': '[some pdf file]'
            }
        });
        process.chdir('test/env');
    });

    afterEach(() => {
        process.chdir('../..');
    });

    test('a typical scenario', async() => {
        const client = createClient({
            uploadZipResult: {}
        });

        const logger = arrayLogger();

        await action({
            logger,
            client,
            inputs: {
                collectionId: 'c123',
                cards: [
                    'some/dir/file.md'
                ],
                containers: {
                    some: {
                        title: 'Some Container!'
                    }
                },
                preferredContainer: 'board_group'
            }
        });

        const call = client.getCalls()[1];
        expect(call.type).toBe('uploadZip');
        expect(call.fileName).toBe(path.basename(call.filePath))
        expect(call.filePath.endsWith('.zip')).toBe(true);

        const { name: dest } = tmp.dirSync();
        await $`unzip ${call.filePath} -d ${dest}`;

        expect(readFileSync(path.join(dest, 'collection.yaml'))).toBe('Tags: []\n');

        expect(readFileSync(path.join(dest, 'cards/some__dir__file.md'))).toBe(`# Test

[test](resources/assets__test.pdf)
`);
        expect(readFileSync(path.join(dest, 'cards/some__dir__file.yaml'))).toBe(`Title: file
ExternalUrl: null
Tags: []
ExternalId: some__dir__file
`);
        expect(readFileSync(path.join(dest, 'board-groups/some.yaml'))).toBe(`Title: Some Container!
Description: null
ExternalUrl: null
Boards:
  - some__dir
ExternalId: some
`);
        expect(readFileSync(path.join(dest, 'boards/some__dir.yaml'))).toBe(`Title: dir
Description: A Dir
ExternalUrl: https://google.com
Items:
  - ID: some__dir__file
    Type: card
ExternalId: some__dir
`);

        expect(readFileSync(path.join(dest, 'resources/assets__test.pdf'))).toBe('[some pdf file]');
    });
});