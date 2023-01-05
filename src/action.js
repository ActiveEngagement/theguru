import fs from 'fs';
import { blobFromSync } from 'node-fetch';
import path from 'path';
import process from 'process';
import { wrapGuruMarkdown } from './api_util.js';
import prepare from './prepare.js';
import createApi from './api.js';
import updateCardId from './update_card_id.js';

export default async function(options) {
    options.logger ||= {
        debug() {}
    };

    const api = createApi(options.client, {
        endpoint: options.guruEndpoint,
        userEmail: options.userEmail,
        userToken: options.userToken,
        logger: options.logger
    });

    async function getNewLocalImageUrl(url) {
        const parentDir = path.dirname(options.filePath);
        const previousDir = process.cwd();
        process.chdir(parentDir);

        const { link } = await api.uploadAttachment(path.basename(url), blobFromSync(url));

        process.chdir(previousDir);

        return link;
    }

    let content = await fs.promises.readFile(options.filePath);

    if(options.cardFooter === undefined || options.cardFooter === null || options.cardFooter === true) {
        options.cardFooter = options.defaultCardFooter;
    }

    if(options.cardFooter && typeof options.cardFooter === 'string') {
        options.cardFooter = options.cardFooter.replaceAll('{{repository_url}}', options.repositoryUrl);
        content += "\n\n" + options.cardFooter;
    }

    content = wrapGuruMarkdown(await prepare(content, { getImageUrl: getNewLocalImageUrl }));

    let existingCard = null;

    if(options.cardId) {
        existingCard = await api.getCard(options.cardId);
    }

    if(existingCard) {
        await api.updateCard(existingCard.id, {
            ...existingCard,
            content
        });
    }
    else {
        const { id } = await api.createCard({
            title: options.cardTitle,
            collectionId: options.collectionId,
            boardId: options.boardId,
            sectionId: options.boardSectionId,
            content
        });

        await updateCardId(id, {
            workflowFile: options.workflowFile,
            jobName: options.jobName
        });

        await options.commitWorkflow({
            path: options.workflowFile,
            email: 'noreply@actengage.com',
            name: 'theguru Action',
            message: 'Update card id\n\nUpdate the workflow file with the new card id.\n\nThis commit was auto-generated by theguru action and likely occurred because a new card was created in Guru.'
        });
    }
}