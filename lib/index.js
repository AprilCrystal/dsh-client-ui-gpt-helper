/**
 * Host (Loader) half of the plugin.
 *
 * The substance is browser-side: this package exists so the Loader has a host
 * row to mount, exactly as the shipped client-only packages are shaped (see
 * `@deepseek-ai/dsh-client-ui-brand-official`, whose host half is an empty
 * `apply`). The browser bundle ships through `exports["./client"]` and is served
 * from `/plugins/<package>/`.
 */

/** Host plugin body — this package contributes browser presentation only. */
export function apply() {}
