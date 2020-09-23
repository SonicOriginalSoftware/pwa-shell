/** @typedef {{"load": () => Promise<void>, "attach": () => Promise<void>, "remove": () => Promise<void>}} Component */
/** @typedef {Map<String, Component>} Components */

/**
 * Add the initial components that will appear immediately following a page load
 *
 * @param {Components} components
 */
export async function add_initial_components(components) {
  // TODO import all the other components that are initially required
}

/** @param {Components} components */
export async function attach_initial_components(components) {
  // TODO attach components to the DOM
}
