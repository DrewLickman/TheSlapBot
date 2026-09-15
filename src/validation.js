export const MAX_BODY_CHARS = 280;
export const MAX_FEELING_CHARS = 32;

function normalizeField(value, name, maxLength) {
  if (typeof value !== 'string') {
    throw new TypeError(`${name} must be text.`);
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new RangeError(`${name} cannot be empty.`);
  }
  if (normalized.length > maxLength) {
    throw new RangeError(`${name} must be ${maxLength} characters or fewer.`);
  }

  return normalized;
}

export function normalizeSlapInput(body, feeling) {
  return {
    body: normalizeField(body, 'Text', MAX_BODY_CHARS),
    feeling: normalizeField(feeling, 'Feeling', MAX_FEELING_CHARS),
  };
}
