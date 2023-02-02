import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import buildContent from './build_content.js';
import { readFile } from './fs_util.js';
import { analyzeTree } from './hast_util.js';
import guruMdBlock from './guru_md_block.js';

export default async function(filePath, cardTitle, options) {
    const { logger, api, github, inputs, imageHandler, footer, existingCardIds, didFileChange } = options;

    logger.info(`Reading ${filePath}`);
    const content = await readFile(filePath);

    // Extract the paths of referenced images from the Markdown file so that we can check whether they have changed.
    const mdastTree = unified()
        .use(remarkParse)
        .parse(content);
    const hastTree = await unified()
        .use(remarkRehype)
        .run(mdastTree);
    const imagePaths = analyzeTree(hastTree, { image: /img/ }).image
        .map(node => node.properties.src);

    // Check whether the Markdown file or any of its images have changed.
    const changed = [filePath, ...imagePaths].some(file => didFileChange(file));
    
    const cardId = existingCardIds[filePath];
    if(cardId && !changed) {
        // If there is an existing card, and it has not changed (to our knowledge), then we'll skip it.
        logger.info(`Skipping card ${cardId} because it has not changed.`);
        return cardId;
    }

    // Build the card content.
    const builtContent = await buildContent(filePath, content, {
        logger,
        api,
        github,
        footer,
        imageHandler
    });
    const wrappedContent = guruMdBlock(builtContent);

    let existingCard = null;

    if(cardId) {
        existingCard = await api.getCard(cardId);
    }

    if(existingCard && !existingCard.archived) {
        logger.info(`Updating previously uploaded card ${cardId}`);
        await api.updateCard(existingCard.id, {
            ...existingCard,
            title: cardTitle,
            content: wrappedContent
        });

        return cardId;
    }
    else {
        if(cardId) {
            logger.info(`Previously uploaded card ${cardId} no longer exists. Creating a new one...`);
        }
        else {
            logger.info('No previously uploaded card found. Creating a new one...');
        }

        const { id } = await api.createCard({
            title: cardTitle,
            collectionId: inputs.collectionId,
            boardId: inputs.boardId,
            sectionId: inputs.boardSectionId,
            content: wrappedContent
        });

        logger.info(`Card ${id} created.`);

        return id;
    }
}