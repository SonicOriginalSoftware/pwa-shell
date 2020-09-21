export const messages = Object.freeze({
  get_app_info: "get_app_info",
  get_db_info: "get_db_info",
  get_oauth_info: "get_oauth_info",
  update: "update"
})

/**
 * @param {keyof messages} message
 * @param {ServiceWorker} sw
 *
 * @returns {Promise<any>}
 */
export async function message(
  message,
  sw = navigator.serviceWorker.controller
) {
  if (!sw) {
    return Promise.reject("Service worker not ready for messaging")
  }
  const messageChannel = new MessageChannel()
  messageChannel.port1.start() // Required when using eventListener interface

  const messagePromise = new Promise((resolve, reject) => {
    messageChannel.port1.addEventListener("messageerror", (ev) => reject(ev))
    messageChannel.port1.addEventListener("message", (ev) => resolve(ev.data))
  })

  sw.postMessage(message, [messageChannel.port2])

  return messagePromise
}
