import generateBase from '../../src/core/synced/generate_collection.js';
import env from '../support/env.js';
import nullLogger from '../support/null_logger.js';
import yaml from 'js-yaml';
import * as types from '../../src/core/synced/container_types.js';

async function generate(options) {
    options.logger ||= nullLogger();
    options.inputs ||= {};
    options.attachmentHandler ||= 'upload';
    options.inputs.preferredContainer ||= types.name(types.BOARD_GROUP);

    return await generateBase(options);
}

const installationSource = `# Let's get this installed!

Woo hoo!
`;
const installationExpected = installationSource;

const configurationSource = `
# Let's get [this](https://google.com) configured!

Just remember, if you haven't installed yet, [do so now](installation.md).
`;
const configurationExpected = `# Let's get [this](https://google.com) configured!

Just remember, if you haven't installed yet, [do so now](cards/top__setup__installation).
`;

const startingSource = `
# Let's get [this](https://google.com) started!

Just remember, if you haven't installed yet, [do so now](installation.md).

Try this out!

![fun image]

[fun image]: /assets/images/fun.png
`;

const startingExpected = `# Let's get [this](https://google.com) started!

Just remember, if you haven't installed yet, [do so now](cards/top__setup__installation).

Try this out!

![fun image]

[fun image]: resources/assets/images/fun.png
`;

const doingSource = `---
title: Doing
---

# Let's do something...

Check [this] out!

![another image](/assets/images/another.jpg)

[this]: ../../assets/more_info.txt
`;

const doingExpected = `# Let's do something...

Check [this] out!

![another image](resources/assets/images/another.jpg)

[this]: resources/assets/more_info.txt
`;

const secretSource = `
# This is a top-secret operation

[link](/random_floating_asset.bin)
`;

const secretExpected = `# This is a top-secret operation

[link](resources/random_floating_asset.bin)
`;

describe('generate_collection.js', () => {
    test('a typical scenario', async() => {
        await env({
            docs: {
                setup: {
                    'installation.md': installationSource,
                    'configuration.md': configurationSource,
                    'getting_started.md': startingSource,
                    'getting_started.yaml': yaml.dump({ title: 'How to finish up. NOT.' }),
                    'unrelated.txt': 'UNRELATED',
                    '.info.yml': yaml.dump({ description: 'Docs about setting up. Duh.' })
                },
                usage: {
                    'doing_useful_things.md': doingSource,
                    empty: {},
                    special: {
                        'top_secret.md': secretSource
                    }
                },
            },
            dir: {
                'LICENSE.md': '# You probably should read this\n',
            },
            'README.md': '# You really should read this\n',
            'random_floating_asset.bin': 'BINBINBIN',
            assets: {
                images: {
                    'fun.png': '[a PNG image]',
                    'another.jpg': '[a JPG image]'
                },
                'more_info.txt': '(more info)'
            }
        });

        process.chdir('test/env');

        const collection = await generate({
            inputs: {
                cards: [
                    'README.md',
                    {
                        rootDir: 'dir/',
                        glob: 'LICENSE.md',
                        title: 'Boring',
                        rootContainer: 'top/legal'
                    },
                    {
                        rootDir: 'docs/',
                        glob: '**/*.md',
                        rootContainer: 'top'
                    }
                ],
                containers: {
                    'top': {
                        title: 'The Very Topmost Container of All',
                        description: "Don't worry about it."
                    },
                    'top/usage/empty': {
                        title: '000',
                        description: 'This is a very important container that does nothing at all.',
                        externalUrl: 'https://google.com'
                    },
                    'random': {}
                },
                attachmentHandler: 'upload'
            },
            footer: false
        });

        process.chdir('../..');

        expect(collection).toStrictEqual({
            tags: [],
            resources: [
                'assets/images/fun.png',
                'assets/images/another.jpg',
                'assets/more_info.txt',
                'random_floating_asset.bin'
            ],
            cards: [
                {
                    name: 'README',
                    title: 'README',
                    externalUrl: null,
                    content: '# You really should read this\n',
                    path: 'README.md',
                    file: 'README.md'
                },
                {
                    name: 'top__legal__LICENSE',
                    title: 'Boring',
                    externalUrl: null,
                    content: '# You probably should read this\n',
                    path: 'top/legal/LICENSE.md',
                    file: 'dir/LICENSE.md'
                },
                {
                    name: 'top__setup__configuration',
                    title: 'configuration',
                    externalUrl: null,
                    content: configurationExpected,
                    path: 'top/setup/configuration.md',
                    file: 'docs/setup/configuration.md',
                },
                {
                    name: 'top__setup__getting_started',
                    title: 'How to finish up. NOT.',
                    externalUrl: null,
                    content: startingExpected,
                    path: 'top/setup/getting_started.md',
                    file: 'docs/setup/getting_started.md'
                },
                {
                    name: 'top__setup__installation',
                    title: 'installation',
                    externalUrl: null,
                    content: installationExpected,
                    path: 'top/setup/installation.md',
                    file: 'docs/setup/installation.md',
                },
                {
                    name: 'top__usage__doing_useful_things',
                    title: 'Doing',
                    externalUrl: null,
                    content: doingExpected,
                    path: 'top/usage/doing_useful_things.md',
                    file: 'docs/usage/doing_useful_things.md'
                },
                {
                    name: 'top__usage__special__top_secret',
                    title: 'top_secret',
                    externalUrl: null,
                    content: secretExpected,
                    path: 'top/usage/special/top_secret.md',
                    file: 'docs/usage/special/top_secret.md'
                }
            ],
            boards: [
                {
                    name: 'top__legal',
                    title: 'legal',
                    externalUrl: null,
                    description: null,
                    items: [
                        {
                            type: 'card',
                            id: 'top__legal__LICENSE'
                        }
                    ],
                    path: 'top/legal'
                },
                {
                    name: 'top__setup',
                    title: 'setup',
                    externalUrl: null,
                    description: 'Docs about setting up. Duh.',
                    items: [
                        {
                            type: 'card',
                            id: 'top__setup__configuration'
                        },
                        {
                            type: 'card',
                            id: 'top__setup__getting_started'
                        },
                        {
                            type: 'card',
                            id: 'top__setup__installation'
                        }
                    ],
                    path: 'top/setup'
                },
                {
                    name: 'top__usage',
                    title: 'usage',
                    externalUrl: null,
                    description: null,
                    items: [
                        {
                            type: 'card',
                            id: 'top__usage__doing_useful_things'
                        },
                        {
                            type: 'section',
                            title: 'special',
                            items: [
                                {
                                    type: 'card',
                                    id: 'top__usage__special__top_secret'
                                }
                            ]
                        },
                        {
                            type: 'section',
                            title: '000',
                            items: []
                        }
                    ],
                    path: 'top/usage'
                }
            ],
            boardGroups: [
                {
                    name: 'top',
                    title: 'top',
                    externalUrl: null,
                    description: null,
                    boards: [
                        'top__legal',
                        'top__setup',
                        'top__usage'
                    ],
                    path: 'top'
                },
                {
                    name: 'random',
                    title: 'random',
                    externalUrl: null,
                    description: null,
                    boards: [],
                    path: 'random'
                }
            ]
        });
    });
});