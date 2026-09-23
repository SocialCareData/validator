# What each message means

Every issue carries a `code`. This page explains each one.

---

## `required-field-missing`

The standard requires this field and your record does not have it.

```
x Missing required field postcode
  at address[0].postcode
  Add `postcode`: UK postcode in standard format (e.g. AB1 2CD).
```

Add the field to the object named in the path. If you genuinely do not hold the
value, that is a data-collection gap rather than a formatting one — the standard
has no way to record "not known" for a required field, and inventing a
placeholder is worse than the gap.

---

## `too-few-values`

The field is present but needs more entries than you supplied. It is an array;
add the missing ones.

---

## `too-many-values`

The field may appear a limited number of times and you supplied more.

```
x name may only appear once - 3 values found
```

Usually a repeated key, or an array where a single value belongs. For `name`
specifically, a subject of care carries exactly one `Name`; alternative and
previous names belong in their own fields, not as extra entries.

---

## `value-not-allowed`

The field is a controlled vocabulary and your value is not in it.

```
x genderCode must be one of the permitted values - you gave 7
  Allowed values: 1, 2, 9, X.
```

The listed values are the tokens to write in JSON, not the full IRIs. A
close-but-wrong value here is very often a local code that has not been mapped to
the national one — fix the mapping rather than the record.

---

## `bad-format`

The value is the right kind of thing but the wrong shape.

```
x postcode is not in the expected format - you gave NOT A POSTCODE
  It should be a UK postcode in upper case, with an optional space, for example `AB1 2CD`.
```

Common causes: lower-case postcodes, dates that are not `YYYY-MM-DD`, identifiers
with separators in them, values with leading or trailing spaces.

---

## `wrong-type`

The value is a different type from the one the standard expects — text where a
number belongs, or a nested object where a plain value belongs.

```
x siblingCount must be a whole number - you gave "two"
```

Watch for numbers exported as strings; `"3"` and `3` are different to a validator.

---

## `wrong-object-type`

A nested object is not the class expected at this position. Check its `@type`, and
that it carries the properties that class requires.

---

## `out-of-range`

A numeric value falls outside the permitted bounds.

```
x otherWeeklyCost must be at least 0 - you gave -50
```

Some bounds are sense checks rather than hard rules and are reported as warnings.
A weekly cost far outside the usual range is worth a second look even when it is
genuinely correct.

---

## `rule-violation`

A conditional rule has been broken — typically an *Other* code selected without
the paired free-text field that must accompany it.

These come from hand-maintained shapes, because LinkML cannot express them. If
the placements rules shape is not published at the ref you are using, you will see
a warning and these checks will not run at all.

---

## `duplicate-child-id`

The same `childId` appears in more than one record in the set you validated.

SHACL validates one record at a time and cannot see across a set, so this check
runs separately over every file given in one command. It follows that validating
files one at a time will never find it — pass them together.

---

## `assumed-context`

Your document had no `@context`, so the selected profile's published context was
used to read the field names. This is normally what you want when pasting plain
JSON, and is informational rather than a problem.

---

## `substituted-context`

Your document named a `@context` by path or URL. This tool does not fetch
arbitrary contexts, so the selected profile's published context was used
instead — that is the one matching the shapes being validated against. If your
own context differs from it, results may not reflect your data as you intended;
inline the context in the document to have it used as written.

---

## `parse-error`

The file is not valid JSON. Fix the syntax first; nothing else could be checked.

---

## `shape-unavailable`

A shape the profile expects could not be fetched, so some checks did not run.
Check the `--ref` you asked for, and your network. Everything reported is still
accurate — there is simply less of it.

---

## `other`

A SHACL constraint failed that this tool does not yet describe in plain terms. Run
with `--json` to see the constraint component, and please
[open an issue](https://github.com/SocialCareData/validator/issues) so it can be
given a proper explanation — that is a bug in this tool, not in your data.
