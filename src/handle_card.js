import buildContent from './build_content.js';
import { pick } from './util.js';

export default async function(options) {
    const { api, logger } = options;

    const content = await buildContent(options.filePath, {
        ...pick(options,
            { footer: 'cardFooter' },
            { defaultFooter: 'defaultCardFooter' },
            'repositoryUrl',
            'logger'
        ),
        api
    });

    let existingCard = null;
    const cardId = options.existingCardIds[options.filePath];

    if(cardId) {
        existingCard = await api.getCard(cardId);
    }

    if(existingCard && !existingCard.archived) {
        logger.info(`Updating previously uploaded card ${cardId}`);
        await api.updateCard(existingCard.id, {
            ...existingCard,
            content
        });

        return cardId;
    }
    else {
        if(cardId) {
            logger.info(`Previously uploaded card ${cardId} no longer exists. A new card will be created.`);
        }
        else {
            logger.info('No previously uploaded card found. Creating a new one...');
        }

        const { id } = await api.createCard({
            title: options.cardTitle,
            collectionId: options.collectionId,
            boardId: options.boardId,
            sectionId: options.boardSectionId,
            content
        });

        logger.info(`Card ${id} created.`);

        return id;
    }
}