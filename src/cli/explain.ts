/*
 * Long-form help for an issue code, mirroring docs/error-reference.md.
 * Kept in the package so `scd-validate explain` works offline.
 */

import type { IssueCode } from '../report/types.js'

export const EXPLANATIONS: Partial<Record<IssueCode, string>> = {
  'required-field-missing':
    'The standard requires this field and your record does not have it.\n\n' +
    'Add the field to the object named in the path. If you genuinely do not hold\n' +
    'the value, that is a data-collection gap rather than a formatting one - the\n' +
    'standard has no way to record "not known" for a required field.',
  'too-few-values':
    'The field is present but needs more entries than you supplied. It is an\n' +
    'array in JSON; add the missing entries.',
  'too-many-values':
    'The field may only appear a limited number of times and you supplied more.\n' +
    'This usually means a repeated key or an array where a single value belongs.',
  'value-not-allowed':
    'The field is a controlled vocabulary: only the listed codes are permitted.\n' +
    'The allowed values shown are the tokens to write in JSON, not the full IRIs.\n' +
    'A close-but-wrong value here is often a local code that has not been mapped\n' +
    'to the national one.',
  'bad-format':
    'The value is the right type but the wrong shape - a postcode without its\n' +
    'space, a date that is not YYYY-MM-DD, an identifier of the wrong length.\n' +
    'The expected format and an example are shown with the issue.',
  'wrong-type':
    'The value is a different kind of thing from the one the standard expects -\n' +
    'text where a number belongs, or a nested object where a plain value belongs.',
  'wrong-object-type':
    'A nested object is not the class the standard expects at this position.\n' +
    'Check its "@type", and that it carries the properties that class requires.',
  'out-of-range':
    'A numeric value falls outside the permitted bounds. Some of these are sense\n' +
    'checks rather than hard rules, and are reported as warnings.',
  'unknown-field':
    'This field is not part of the standard at this position. Most often a\n' +
    'spelling or casing slip; the suggestion, when there is one, is the closest\n' +
    'field the standard does define.',
  'rule-violation':
    'A conditional rule has been broken - typically an "Other" code selected\n' +
    'without the paired free-text field that must accompany it. These rules come\n' +
    'from hand-maintained shapes, because LinkML cannot express them.',
  'duplicate-child-id':
    'The same childId appears in more than one record in the set you validated.\n' +
    'SHACL cannot see across records, so this check runs separately over all the\n' +
    'files given in one command.',
  'input/assumed-context':
    'Your document had no "@context", so the selected profile\'s published\n' +
    'context was used to interpret the field names. This is usually what you\n' +
    'want when pasting plain JSON.',
  'input/substituted-context':
    'Your document pointed at a "@context" by relative path. This tool does not\n' +
    'have that file, so it used the profile\'s published context instead. If your\n' +
    'local context differs from the published one, results may not match.',
  'input/parse-error':
    'The file is not valid JSON. Fix the syntax before anything else - nothing\n' +
    'else could be checked.',
  'catalogue/shape-unavailable':
    'A shape the profile expects could not be fetched. Validation continued\n' +
    'without it, so some checks did not run. Check the --ref you asked for.',
  other:
    'A SHACL constraint failed that this tool does not yet describe in plain\n' +
    'terms. Run with --verbose to see the constraint component, and please open\n' +
    'an issue so it can be given a proper explanation.',
}

export function explain (code: string): string | undefined {
  return EXPLANATIONS[code as IssueCode]
}
