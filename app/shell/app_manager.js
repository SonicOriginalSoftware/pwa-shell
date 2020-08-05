const appStatusElement = document.getElementById("app-status")

/** @type {Map<String, import('../lib/components/component.js').Component>} */
let components = new Map()
/** @type {{'name': String, version: String}} */
let info

function load_initial_components() {
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
 */
export async function register_components() {
  let initModule
  try {
    initModule = await import("/init.js")
  } catch (reason) {
    handle_error(`${reason.message} - Couldn't import init module`)
    return
  }

  try {
    await initModule.addInitialComponents(components)
  } catch (reason) {
    handle_error(
      `${reason.message} - Failed adding ${reason.component} component`
    )
    return
  }

  try {
    await load_initial_components()
  } catch (reason) {
    handle_error(
      `${reason.message} - Failed loading ${reason.component} component`
    )
    return
  }

  try {
    await initModule.attachInitialComponents(components)
  } catch (reason) {
    handle_error(
      `${reason.message} - Failed attaching ${reason.component} component`
    )
    return
  }

  appStatusElement?.remove()
}

/** @param {ServiceWorkerRegistration} registered_service_worker */
async function service_worker_registered(registered_service_worker) {
  if (!registered_service_worker || !registered_service_worker.active) {
    if (registered_service_worker && registered_service_worker.installing)
      handle_error("Service worker stuck installing!")

    return handle_error("App was not registered correctly.")
  }

  const sw_module = await import("/lib/service-worker/service_worker.js")
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

  register_components()

  if (registered_service_worker.waiting) {
    // TODO emit the app_update event
    alert('New update available!')
  }
}

/** @param {any} err Error to display to `console.error` */
function handle_error(err) {
  appStatusElement.innerHTML = err || "Web app failed to load"
  console.error(err)
}

window.addEventListener("load", async () => {})

navigator.serviceWorker.addEventListener("controllerchange", () => {
  sessionStorage.clear()
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
