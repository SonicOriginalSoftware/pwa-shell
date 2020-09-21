/** @typedef {Map<String, import('../lib/icomponent.js').IComponent>} Components */

const appStatusElement = document.getElementById("app-status")

/** @param {Components} components */
function load_initial_components(components) {
  const loadComponentsPromises = []
  for (const [id, component] of components) {
    loadComponentsPromises.push(
      new Promise(async (resolve, reject) => {
        appStatusElement?.insertAdjacentHTML(
          "beforeend",
          `<span style='display: block;' id='load-${id}'>Loading ${id}...</span>`
        )
        console.log(`Loading ${id}...`)
        try {
          await component.load()
        } catch (reason) {
          reject({ reason: reason, component: id })
          return
        }
        console.log(`${id} loaded!`)
        document.getElementById(`load-${id}`).innerHTML = `Loaded ${id}!`
        resolve()
      })
    )
  }
  return Promise.all(loadComponentsPromises)
}

/**
 * This function is run after service worker registration has completed
 * with an active service worker
 *
 * This imports the consumer init module, adds initial components, loads them, and attaches them
 *
 * Note that there may be a service worker waiting as well
 *
 * @param {ServiceWorker} service_worker_waiting
 */
async function register_components(service_worker_waiting) {
  let initModule
  try {
    initModule = await import("/init.js")
  } catch (reason) {
    handle_error(`${reason.message} - Couldn't import init module`)
    return
  }

  /** @type {Components} */
  let components = new Map()

  try {
    await initModule.add_initial_components(components)
  } catch (reason) {
    handle_error(
      `${reason.message} - Failed adding ${reason.component} component`
    )
    return
  }

  try {
    await load_initial_components(components)
  } catch (reason) {
    handle_error(
      `${reason.message} - Failed loading ${reason.component} component`
    )
    return
  }

  try {
    await initModule.attach_initial_components(components)
  } catch (reason) {
    handle_error(
      `${reason.message} - Failed attaching ${reason.component} component`
    )
    return
  }

  appStatusElement?.remove()

  if (service_worker_waiting) {
    // TODO emit the app_update event
    alert("New update available!")
    console.log("New service worker version available")
  }
}

/** @param {ServiceWorkerRegistration} registered_service_worker */
async function service_worker_registered(registered_service_worker) {
  console.debug("Service worker finished registering!")
  if (registered_service_worker === undefined) {
    handle_error("No service worker registered!")
  } else {
    if (registered_service_worker.active === undefined) {
      return handle_error("No service worker active!")
    } else if (registered_service_worker.installing) {
      return handle_error("Service worker still installing...")
    }
  }

  const sw_module = await import("/lib/service-worker/service_worker.js")

  /** @type {{'name': String, version: String}} */
  let info
  try {
    info = await sw_module.message(
      sw_module.messages.get_app_info,
      registered_service_worker.active
    )
  } catch (ex) {
    console.error(ex)
    return Promise.reject("Could not communicate with service worker!")
  }

  document.title = info.name

  register_components(registered_service_worker.waiting)
}

/** @param {any} err */
function handle_error(err) {
  appStatusElement.innerHTML = err || "Web app failed to load"
  console.error(err)
}

window.addEventListener("load", async () => {})

navigator.serviceWorker.addEventListener("controllerchange", () => {
  sessionStorage.clear()
  console.log("New service worker registered! Reloading...")
  window.location.reload()
})

navigator.serviceWorker
  .register("/shell/sw.js", {
    scope: "/",
    updateViaCache: "none",
    // type: 'module',
  })
  .then(service_worker_registered)
  .catch(handle_error)
