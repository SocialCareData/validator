/*
 * The validator component: a page section that checks JSON and JSON-LD
 * records against SHACL shapes, configured with a list of standards.
 *
 * This directory imports nothing from outside itself except
 * @theodi/data-standard-validator, so it can move into its own package as is.
 */

export { mountValidator, type MountedValidator } from './mount.js'
export type { ValidatorConfig, StandardConfig } from './config.js'
