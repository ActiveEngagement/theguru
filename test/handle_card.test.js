import runHandleCard from '../src/handle_card.js';
import createApi from '../src/api.js';
import { FetchError } from '../src/error.js';
import createClient from './support/api_client.js';
import { resource } from './support/util.js';
import { pick } from '../src/util.js';
import nullLogger from './support/null_logger.js';

async function handleCard(options) {
    options.logger ||= nullLogger();
    if(options.client) {
        options.api = createApi(options.client, pick(options, 'logger'));
        delete options.client;
    }
    options.existingCardIds ||= [];

    return await runHandleCard(options);
}

function apiCall(type, body) {
    return {
        type,
        options: {
            body,
            headers: {
                accept: 'application/json',
                authorization: 'Basic dW5kZWZpbmVkOnVuZGVmaW5lZA==',
                'content-type': 'application/json'
            }
        }
    };
}

function createCardApiCall(options) {
    return apiCall('createCard', {
        shareStatus: 'TEAM',
        ...options
    });
}

function updateCardApiCall(options) {
    return apiCall('updateCard', options);
}

describe.each([
    [undefined],
    [{}],
    [{ 'unrelated/path': 'card123', 'also/unrelated': 'card456' }]
])('when the path is not present in the cards file', (existingCardIds) => {
    describe.each([
        [undefined, undefined, []],
        ['board123', undefined, [{ id: 'board123' }]],
        [
            'board123',
            'boardSection123',
            [{
                id: 'board123',
                action: {
                    actionType: 'add',
                    prevSiblingItem: 'boardSection123',
                    sectionId: 'boardSection123'
                }
            }],
        ],
        [undefined, 'boardSection123', []],
    ])('optionally with boardId and boardSectionId', (boardId, boardSectionId, boards) => {
        let client = null;

        beforeEach(async() => {
            client = createClient({ createCardResult: { id: 'newCard123' } });

            await handleCard({
                client,
                filePath: 'test/resources/test_card.md',
                cardTitle: 'Test Card',
                collectionId: 'c123',
                boardId,
                boardSectionId,
                existingCardIds
            });
        });

        it('makes exactly one api request to create the card', async() => {
            expect(client.getCalls().length).toBe(1);
            expect(client.getCalls()[0]).toEqual(createCardApiCall({
                preferredPhrase: 'Test Card',
                collection: { id: 'c123' },
                boards,
                content: await resource('test_card_expected_output.html')
            }));
        });
    });
});


describe.each([
    [undefined, undefined, undefined],
    ['collection123', undefined, undefined],
    ['collection123', 'board123', undefined],
    ['collection123', 'board123', 'boardSection123'],
])('when a card id is present', (collectionId, boardId, boardSectionId) => {
    let client = null;

    beforeEach(async() => {
        client = createClient({ getCardResult: { } });

        await handleCard({
            client,
            filePath: 'test/resources/test_card.md',
            cardTitle: 'Final',
            collectionId,
            boardId,
            boardSectionId,
            existingCardIds: { 'test/resources/test_card.md': 'existing123' }
        });
    });

    it('updates the card', async() => {
        expect(client.getCalls()[1]).toEqual(updateCardApiCall({
            content: await resource('test_card_expected_output.html')
        }));
    });
});

describe.each([
    [undefined, undefined, []],
    ['board123', undefined, [{ id: 'board123' }]],
    [
        'board123',
        'boardSection123',
        [{
            id: 'board123',
            action: {
                actionType: 'add',
                prevSiblingItem: 'boardSection123',
                sectionId: 'boardSection123'
            }
        }],
    ],
    [undefined, 'boardSection123', []],
])('when a nonexistent card id is present', (boardId, boardSectionId, boards) => {
    let client = null;

    beforeEach(async() => {
        client = createClient({
            getCardResult: null,
            createCardResult: { id: 'newCard123' }
        });

        await handleCard({
            client,
            filePath: 'test/resources/test_card.md',
            cardTitle: 'Test Card',
            collectionId: 'c123',
            boardId,
            boardSectionId,
            existingCardIds: {
                'test/resources/test_card.md': '234982093483'
            }
        });
    });

    it('makes an api request to create the card', async() => {
        expect(client.getCalls()[1]).toEqual(createCardApiCall({
            preferredPhrase: 'Test Card',
            collection: { id: 'c123' },
            boards,
            content: await resource('test_card_expected_output.html')
        }));
    });
});

describe('when an archived card id is present', () => {
    let client = null;

    beforeEach(async() => {
        client = createClient({
            getCardResult: { id: 'card123', archived: true },
            createCardResult: { id: 'newCard123' }
        });

        await handleCard({
            client,
            filePath: 'test/resources/test_card.md',
            cardTitle: 'Test Card',
            collectionId: 'c123',
            existingCardIds: { 'test/resources/test_card.md': 'card123' }
        });
    });

    it('makes an api request to create the card', async() => {
        expect(client.getCalls()[1]).toEqual(createCardApiCall({
            preferredPhrase: 'Test Card',
            collection: { id: 'c123' },
            boards: [],
            content: await resource('test_card_expected_output.html')
        }));
    });
});

it('uploads local images', async() => {
    const client = createClient({
        attachmentResult: { link: 'https://example.com/attachment.png' }
    });

    await handleCard({
        client,
        filePath: 'test/resources/test_card_with_local_image.md',
        cardTitle: 'Local Image',
        collectionId: 'c123'
    });

    expect(client.getCalls()[0]).toMatchObject({
        type: 'uploadAttachment',
        fileName: 'empty.png',
        options: {
            headers: {
                accept: 'application/json',
                authorization: 'Basic dW5kZWZpbmVkOnVuZGVmaW5lZA=='
            }
        }
    });

    expect(client.getCalls()[1].options.body.content).toEqual(
        await resource('test_card_with_local_image_expected_output.html')
    );
});

test('with string card footer appends it', async() => {
    const client = createClient();

    await handleCard({
        client,
        filePath: 'test/resources/test_card.md',
        cardTitle: 'Test Card',
        collectionId: 'c123',
        cardFooter: '<{{repository_url}}>',
        repositoryUrl: 'https://example.com'
    });

    expect(client.getCalls()[0].options.body.content).toEqual(
        await resource('test_card_with_footer_expected_output.html')
    );
});

test.each([
    [true],
    [undefined],
    [null]
])('with true or undefined or null card footer appends default', async(cardFooter) => {
    const client = createClient();

    await handleCard({
        client,
        filePath: 'test/resources/test_card.md',
        cardTitle: 'Test Card',
        collectionId: 'c123',
        cardFooter,
        repositoryUrl: 'https://example.com',
        defaultCardFooter: '<{{repository_url}}>'
    });

    expect(client.getCalls()[client.getCalls().length - 1].options.body.content).toEqual(
        await resource('test_card_with_footer_expected_output.html')
    );
});

test('with no card footer given appends default', async() => {
    const client = createClient();

    await handleCard({
        client,
        filePath: 'test/resources/test_card.md',
        cardTitle: 'Test Card',
        collectionId: 'c123',
        repositoryUrl: 'https://example.com',
        defaultCardFooter: '<{{repository_url}}>'
    });

    expect(client.getCalls()[client.getCalls().length - 1].options.body.content).toEqual(
        await resource('test_card_with_footer_expected_output.html')
    );
});

test.each([
    [''],
    [false],
    [123],
    [123.45]
])('with any other non-string card footer does not append it', async(cardFooter) => {
    const client = createClient();

    await handleCard({
        client,
        filePath: 'test/resources/test_card.md',
        cardTitle: 'Test Card',
        collectionId: 'c123',
        cardFooter,
        repositoryUrl: 'https://example.com',
        defaultCardFooter: '<{{repository_url}}>'
    });

    expect(client.getCalls()[client.getCalls().length - 1].options.body.content).toEqual(
        await resource('test_card_expected_output.html')
    );
});

test('with failed server JSON response throws proper error', async() => {
    const client = {
        getCard() {
            return {
                ok: false,

                status: 400,

                text() {
                    return JSON.stringify(this.json());
                },

                json() {
                    return { description: 'Custom error message!' };
                }
            };
        }
    };

    let error = null;
    let response = null;

    try {
        response = await handleCard({
            client,
            filePath: 'test/resources/test_card.md',
            cardTitle: 'Test Card',
            collectionId: 'c123',
            existingCardIds: { 'test/resources/test_card.md': 'card123', }
        });
    }
    catch (e) {
        if(e instanceof FetchError) {
            error = e;
        }
        else {
            throw e;
        }
    }

    expect(response).toBe(null);
    expect(error.toString()).toBe('FetchError: Server responded with a 400 status code: Custom error message!');
});

test('with failed server text response throws proper error', async() => {
    const client = {
        getCard() {
            return {
                ok: false,

                status: 403,

                text() {
                    return 'Some error response.';
                },

                json() {
                    return null;
                }
            };
        }
    };

    let error = null;
    let response = null;

    try {
        response = await handleCard({
            client,
            filePath: 'test/resources/test_card.md',
            cardTitle: 'Test Card',
            collectionId: 'c123',
            existingCardIds: { 'test/resources/test_card.md': 'card123', }
        });
    }
    catch (e) {
        if(e instanceof FetchError) {
            error = e;
        }
        else {
            throw e;
        }
    }

    expect(response).toBe(null);
    expect(error.toString()).toBe('FetchError: Server responded with a 403 status code');
});

test('with null server response throws proper error', async() => {
    const client = {
        getCard() {
            return {
                ok: true,

                status: 200,

                text() {
                    return null;
                },

                json() {
                    return null;
                }
            };
        }
    };

    let error = null;
    let response = null;

    try {
        response = await handleCard({
            client,
            filePath: 'test/resources/test_card.md',
            cardTitle: 'Test Card',
            collectionId: 'c123',
            existingCardIds: { 'test/resources/test_card.md': 'card123', }
        });
    }
    catch (e) {
        if(e instanceof FetchError) {
            error = e;
        }
        else {
            throw e;
        }
    }

    expect(response).toBe(null);
    expect(error.toString()).toBe('FetchError: Server responded with an invalid response');
});

test('with non-JSON server response throws proper error', async() => {
    const client = {
        getCard() {
            return {
                ok: true,

                status: 200,

                text() {
                    return 'Random response.';
                },

                json() {
                    return null;
                }
            };
        }
    };

    let error = null;
    let response = null;

    try {
        response = await handleCard({
            client,
            filePath: 'test/resources/test_card.md',
            cardTitle: 'Test Card',
            collectionId: 'c123',
            existingCardIds: { 'test/resources/test_card.md': 'card123', }
        });
    }
    catch (e) {
        if(e instanceof FetchError) {
            error = e;
        }
        else {
            throw e;
        }
    }

    expect(response).toBe(null);
    expect(error.toString()).toBe('FetchError: Server responded with an invalid response');
});