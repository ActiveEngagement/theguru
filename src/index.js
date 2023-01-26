import core from '@actions/core';
import github from '@actions/github';
import nodeFetch from 'node-fetch';
import c from 'ansi-colors';
import { readFile } from './fs_util.js';
import { wrapResponse } from './api_util.js';
import getInputs from './inputs.js';
import createClient from './api_client.js';
import commitCardsFile from './commit_cards_file.js';
import action from './action.js';
import version from './version.cjs';
import { performance } from 'perf_hooks';
import { isRepoPublic } from './util.js';
import getChangedFilesBase from './file_changes.js';

async function main() {
    try {
        const start = performance.now();
        const inputs = getInputs(core.getInput);

        const logger = {
            debug(message) {
                if(this.isDebug()) {
                    core.debug(message);
                }
            },

            info(message) {
                core.info(message);
            },

            warning(message) {
                core.warning(message);
            },

            startGroup(name) {
                core.startGroup(name);
            },

            endGroup() {
                core.endGroup();
            },

            isDebug() {
                return core.isDebug() || inputs.debugLogging;
            }
        };

        logger.info(`Here we go! ${c.yellow(`theguru v${version}`)} is ready for takeoff!`);
        logger.debug(`Inputs: ${JSON.stringify(inputs)}`);

        async function fetch(method, url, options = {}) {
            options.method = options.method || method;
            logger.debug(`Sending HTTP request to ${url} with options: ${JSON.stringify(options)}`);

            const response = wrapResponse(await nodeFetch(url, options));

            logger.debug(`Received response from ${url}: ${await response.text()}`);

            return response;
        }

        const repositoryName = github.context?.payload?.repository?.full_name;
        const repositoryUrl = `${github.context.serverUrl}/${repositoryName}`;
        const sha = github.context.sha;
        const isPublic = await isRepoPublic(repositoryUrl);
        const commitMessage = inputs.github.event.head_commit?.message;
        const defaultCardFooter = await readFile(new URL('resources/default_card_footer.md', import.meta.url));
        const client = createClient(fetch);

        await action({
            ...inputs,
            defaultCardFooter,
            client,
            logger,
            commitCardsFile,
            github: {
                repositoryName,
                repositoryUrl,
                sha,
                isPublic,
                commitMessage
            },
            getChangedFiles: opts => getChangedFilesBase({ ...opts, github: inputs.github })
        });

        const elapsed = ((performance.now() - start) / 1000).toFixed(2);
        logger.info(`All done in ${c.green(`${elapsed} seconds`)}!`);
    }
    catch (error) {
        core.info('A fatal exception ocurred!');
        core.debug('Error:');
        core.debug(error);

        core.setFailed(error);
    }
}

main();