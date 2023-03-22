import path from 'path';
import { root, card, attach, traversePath, ensureContainerPath } from './tree_util.js';
import { glob } from '../util.js';

/**
 * Builds a basic tree of cards and containers from the given set of card rules. This tree contains only file paths
 * and types, plus any info contained in the rules themselves.
 */
export default function(rules, options) {
    const { logger } = options;

    const tree = root();

    rules.forEach(applyRule);

    return tree;

    /**
     * Gets the path to the appropriate container for the given card file path, rule by which the card was indicated,
     * and parent directory.
     * 
     * If the path does not currently exist in the tree, it will be created.
     */
    function getContainerForCard(rule, file, parentDir) {
        if(rule.container) {
            // If the container was specified explicitly in the rule, then it takes precedence.
            // Traverse the specified path, creating any missing containers.
            //
            // Do note that no file paths are included when missing containers are created, because there is no
            // guarantee of a corresponding directory.
            return ensureContainerPath(tree, rule.container);
        }

        let rootContainer;

        const rootContainerPath = rule.rootContainer;
        if (rootContainerPath) {
            // If the user has specified a "root container" path in the rule, then we need to evaluate it and then
            // evaluate the actual container path beneath it.
            //
            // Note that no file paths are included in any created containers, since there are likely no corresponding
            // directories.
            rootContainer = ensureContainerPath(tree, rootContainerPath);
        } else {
            // If no root container path was specified, then the container path will be evaluated beneath the tree itself.
            rootContainer = tree;
        }

        let container;

        let containerPath = path.dirname(file);
        if (containerPath !== '.') {
            // If the file is in one or more sub-directories, then we need to traverse the path (beneath the root
            // container), creating any containers not yet in the tree and attaching the correct file path.
            //
            // NOTE that the file path is intentionally attached for ANY missing container along the path, whether
            // newly created or not.
            // This way, if the container was originally created by some other method (say, an explicit container clause
            // in a rule, but also referenced by a rule containing a card beneath a subdirectory, then the file will
            // still get attached as it should and info files will still be read).
            container = traversePath(rootContainer, containerPath, (node, ctx, util) => {
                node = util.makeMissing();

                if (!node.file) {
                    node.file = path.join(parentDir, ctx.path);
                }
            });
        } else {
            // If the file is top-level (i.e. with no parent directory), then no further containers are needed and we'll
            // return the root container.
            container = rootContainer;
        }

        return container;
    }

    /**
     * Adds appropriate container and card nodes to the tree for the given card rule, under the given parent directory
     * (which may be blank).
     */
    function applyRuleForParentDir(rule, parentDir) {
        const files = glob(rule.glob, {
            cwd: parentDir,
            nodir: true
        });

        for(const file of files) {
            const fullPath = path.join(parentDir, file);
            const container = getContainerForCard(rule, file, parentDir);
            const name = path.basename(file);

            attach(container, name, card({
                file: fullPath,
                title: rule.title || null,
                externalUrl: rule.externalUrl || null
            }));
        }
    }

    /**
     * Adds appropriate nodes to the tree for the given card rule.
     */
    function applyRule(rule) {
        // A lone string is interpretated as a basic glob.
        if(typeof rule === 'string') {
            applyRule({ glob: rule });

            return;
        }

        if(rule.rootDir) {
            // If there's a root dir glob, then apply the rule for each indicated root dir.

            if(!rule.rootDir.endsWith('/')) {
                logger.warning(`Card rule rootDir "${rule.rootDir}" does not end with a "/". This was probably an accident, so we will append one.`);
                rule.rootDir += '/';
            }

            glob(rule.rootDir).forEach(p => applyRuleForParentDir(rule, p));
        }
        else {
            // Otherwise, apply the rule without any parent dir.
            applyRuleForParentDir(rule, '');
        }
    }
}