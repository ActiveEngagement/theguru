import path from 'path';
import fs from 'fs';
import { readFile, stripExtension } from '../../fs_util.js';
import { traverse } from './util.js';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { allowedCardInfo, allowedContainerInfo } from '../allowed_info.js';
import { inferTitle } from '../../util.js';

/**
 * Traverses the given card/container tree and attempts to attach information (e.g. titles, external urls, descriptions,
 * etc.) from the following sources:
 *  - The default title is a "titleized" version of the file/directory name.
 *  - Cards may have a "frontmatter" section that contains info attributes.
 *  - Directories representing containers may have a ".info.yml" file containing info attributes.
 *  - Card Markdown files may have a corresponding YAML file with the same basename containing info attributes.
 * 
 * Note that as a side effect any info currently in the tree will be validated and fixed if necessary.
 */
export default function(tree, options) {
    const { logger, colors } = options;

    traverse(tree).do((node, name, state) => {
        logger.info(colors.bold(state.path));
        logger.indent();

        // The default title is a titleized form of the filename.
        node.info.title ||= inferTitle(name);

        if(node.type === 'card') {
            // We'll read from the frontmatter if it exists and save the content for later.
            const { data, content } = matter(readFile(node.file));

            Object.assign(node.info, data);

            if(data && Object.keys(data).legnth !== 0) {
                logger.info('Using frontmatter');
            }

            node.content = content;

            // We'll read from the associated .yml or .yaml file if it exists.
            const name = stripExtension(node.file);
            const infoPath = [name + '.yaml', name + '.yml'].find(p => fs.existsSync(p));
            if(infoPath) {
                logger.info(`Using ${infoPath}`);
                Object.assign(node.info, yaml.load(readFile(infoPath)));
            }

            // Let's make sure only valid info was added.
            for(const key of Object.keys(node.info)) {
                if(!allowedCardInfo.includes(key)) {
                    delete node.info[key];
                    logger.warning(`Card "${state.path}" contains invalid info key "${key}". It will be ignored.`);
                }
            }

            const sanitized = sanitizeTitle(node.info.title);

            if(node.info.title !== sanitized) {
                node.info.title = sanitized;
                logger.info('Some invalid characters in the "title" were stripped out.');
            }
        }
        else if(node.type === 'container') {
            if(node.file) {
                // We'll read from the info file in the directory if it exists.
                const infoBase = path.join(node.file, '.info');
                const infoPath = [infoBase + '.yaml', infoBase + '.yml'].find(p => fs.existsSync(p));
                if(infoPath) {
                    logger.info(`Using ${infoPath}`);
                    Object.assign(node.info, yaml.load(readFile(infoPath)));
                }
            }

            // Let's make sure only valid info was added.
            for(const key of Object.keys(node.info)) {
                if(!allowedContainerInfo.includes(key)) {
                    delete node.info[key];
                    logger.warning(`${state.path} contains invalid info key "${key}". It will be ignored.`);
                }
            }

            const sanitized = sanitizeTitle(node.info.title);

            if(node.info.title !== sanitized) {
                node.info.title = sanitized;
                logger.info('Some invalid characters in the "title" were stripped out.');
            }
        }

        logger.trace(`Evaluated info: ${JSON.stringify(node.info)}`);
        logger.unindent();
    });
}


function sanitizeTitle(title) {
    return title.replaceAll(/[^a-zA-Z\d\s()\-_'"\.,]/g, '');
}