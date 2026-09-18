import type { FocusEvent } from 'react';

/** Select existing numbers so typing replaces the default or saved value. */
export function selectNumberOnFocus(event: FocusEvent<HTMLElement>) {
  const input = event.target;
  if (input instanceof HTMLInputElement && input.type === 'number' && !input.readOnly) {
    input.select();
  }
}
