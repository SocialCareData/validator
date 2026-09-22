/*
 * Tests hit the real ontology repo, because validating against anything else
 * would not prove what the suite claims to prove. A cache in the repo
 * (gitignored) keeps reruns offline and lets CI restore it between jobs.
 */

import { DiskCache } from '../../src/node.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
export const testCache = new DiskCache(join(here, '..', '..', '.cache', 'shapes'))
