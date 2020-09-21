importScripts("../config.js")

async function remove_obselete_databases() {
  if (navigator.userAgent.match(/firefox/i) !== null) {
    console.error(
      "Sorry, you appear to be using the shitty Firefox browser. " +
        "Until the dumbass devs pull their heads out they asses, " +
        "you won't be able to use this app properly."
    )
    return
  }

  console.log(`Removing obsolete databases...`)
  for (const [
    each_database_name,
    each_database_version,
  ] of await indexedDB.databases()) {
    if (each_database_version === db_info.version) continue
    if (each_database_name !== db_info.name) {
      console.debug(`  Removing ${each_database_name}...`)
      indexedDB.deleteDatabase(each_database_name)
      console.debug(`  Removed ${each_database_name}!`)
    }
  }
  console.log(`Obsolete databases removed!`)
}

/** Handles shell indexedDB creation */
function install_db() {
  return new Promise((resolve, reject) => {
    console.log(`Opening version ${db_info.version} of ${db_info.name}...`)

    const indexed_db_open_request = indexedDB.open(
      db_info.name,
      db_info.version
    )

    indexed_db_open_request.addEventListener("error", (ev) => {
      console.error(ev)
      reject(ev)
    })

    indexed_db_open_request.addEventListener("upgradeneeded", async () => {
      console.log(`${indexed_db_open_request.result.name} needs upgraded...`)
      await upgrade_db(indexed_db_open_request.result)
    })

    indexed_db_open_request.addEventListener("success", (_) => {
      const result_name = indexed_db_open_request.result.name
      if (result_name !== db_info.name) {
        reject("Opened the wrong database!")
        return
      }

      const result_version = indexed_db_open_request.result.version
      if (result_version !== db_info.version) {
        reject("Opened the wrong database version!")
        return
      }

      console.log(
        `Opened version ${db_info.version} of ${db_info.name}. Closing...`
      )

      indexed_db_open_request.result.close()
      resolve()
    })
  })
}

/**
 * Handles database upgrading
 *
 * i.e. object store creation, index creation in each object store, and prior
 * data migration
 *
 * @param {IDBDatabase} db
 */
async function upgrade_db(db) {
  console.log(`Upgrading ${db.name}...`)
  await pre_db_upgrade()

  // TODO Could parallelize this...
  for (
    let eachStoreNameIndex = 0;
    eachStoreNameIndex < db.objectStoreNames.length;
    ++eachStoreNameIndex
  ) {
    const object_store_name = db.objectStoreNames[eachStoreNameIndex]
    console.debug(`  Deleting object store: ${object_store_name}...`)
    db.deleteObjectStore(object_store_name)
    console.debug(`  ${object_store_name} deleted!`)
  }

  // TODO Could parallelize this...
  for (const [each_store_name, each_store_indices] of object_stores) {
    console.debug(`  Creating object store: '${each_store_name}'...`)
    const object_store = db.createObjectStore(each_store_name)
    for (const each_index of each_store_indices) {
      console.debug(`    Creating index: ${each_index.name}`)
      object_store.createIndex(each_index.name, each_index.keyPath)
      console.debug(`    Created index: ${each_index.name}`)
    }
    console.debug(`  Created object store: ${each_store_name}`)
  }

  await post_db_upgrade()
  console.log(`${db.name} upgraded!`)
}

async function remove_all_caches() {
  console.log("Removing all caches...")
  await Promise.all(
    (await caches.keys()).map(
      (each_cache_name) =>
        new Promise((resolve) => {
          console.debug(`  Removing cache: ${each_cache_name}`)
          resolve(caches.delete(each_cache_name))
        })
    )
  )
  console.log("All caches removed!")
}

async function install_caches() {
  console.log("Installing all caches...")
  await Promise.all(
    app_caches.map(
      (each_cache_tuple) =>
        new Promise(async (resolve) => {
          console.debug(`  Adding cache: ${each_cache_tuple[0]}`)
          resolve(
            await (await caches.open(each_cache_tuple[0])).addAll(
              each_cache_tuple[1]
            )
          )
        })
    )
  )
  console.log("Caches installed!")
}

/**
 * @param {String} path
 * @param {Request} request
 */
async function get_cache_response(path, request) {
  let response = null
  try {
    for (const each_cache_name of await caches.keys()) {
      const each_cache = await caches.open(each_cache_name)
      response =
        (await each_cache.match(path)) ||
        (await each_cache.match(request, { ignoreSearch: true }))
      if (response) break
    }
  } catch (err) {
    console.error(err)
  }
  return (
    response ||
    Promise.resolve(
      new Response(`Could not find ${path}`, {
        status: 404,
        statusText: "Could not find resource in cache",
      })
    )
  )
}

/** @param {ExtendableEvent} install_event */
function handle_install(install_event) {
  console.log(`Installing app version ${app_info.version}...`)
  install_event.waitUntil(
    new Promise(async (resolve) => {
      await Promise.all([install_db()])
      console.log(`App version ${app_info.version} installed!`)
      resolve()
    })
  )
}

/** @param {ExtendableEvent} activate_event */
function handle_activate(activate_event) {
  console.log(`Activating app version ${app_info.version}...`)
  activate_event.waitUntil(
    new Promise(async (resolve) => {
      await Promise.all([remove_obselete_databases(), remove_all_caches()])
      await install_caches()
      self.clients.claim()
      console.log(`Activated app version ${app_info.version}!`)
      resolve()
    })
  )
}

/** @param {ExtendableMessageEvent} message_event */
async function handle_message(message_event) {
  switch (message_event.data) {
    case "get_app_info":
      message_event.ports[0].postMessage({
        name: app_info.name,
        version: app_info.version,
      })
      break
    case "get_db_info":
      message_event.ports[0].postMessage({
        name: db_info.name,
        version: db_info.version,
      })
      break
    case "get_oauth_info":
      message_event.ports[0].postMessage({
        clientId: oauth_info.clientId,
        apiKey: oauth_info.apiKey,
      })
      break
    case "update":
      console.log(`Jumping to version ${app_info.version}...`)
      self.skipWaiting()
      break
  }
}

/**
 * The fetch event handler
 *
 * If the requested path is in the pathWhiteList, attempts to respond with a
 * network fetch of the request first
 *     If that fails, returns the cached lookup
 *
 * Otherwise, a cached lookup occurs
 *
 * If the cached lookup fails, returns a response indicating an error occurred
 *
 * @param {FetchEvent} fetch_event
 */
function handle_fetch(fetch_event) {
  const request = fetch_event.request
  const url = new URL(request.url)
  const path = url.pathname
  const domain = url.origin
  fetch_event.respondWith(
    new Promise(async (resolve) => {
      if (
        fetch_network_first_list.indexOf(path) >= 0 ||
        fetch_network_first_list.indexOf(domain) >= 0
      ) {
        let fetchResponse
        try {
          fetchResponse = await fetch(request)
        } catch (err) {
          resolve(get_cache_response(path, request))
          return
        }

        if (
          cache_after_fetch_white_list.indexOf(path) >= 0 ||
          cache_after_fetch_white_list.indexOf(domain) >= 0
        ) {
          const cache_after_fetch_cache = await caches.open(
            cache_after_fetch_cache_name
          )
          await cache_after_fetch_cache.put(request, fetchResponse.clone())
        }
        resolve(fetchResponse)
      } else {
        resolve(get_cache_response(path, request))
      }
    })
  )
}

const cache_after_fetch_cache_name = "cache-after-fetch"

/** @type {Array<[String, String[]]>} */
const app_caches = [
  [cache_after_fetch_cache_name, []],
  [
    "shell-cache",
    [
      "/",
      "/app.css",
      "/config.js",
      "/favicon.ico",
      "/init.js",
      "/lib/service-worker/service_worker.js",
      "/shell/app_manager.js",
      "/manifest.json",
    ],
  ],
  ["pwa-icons", ["/icons/icon-192px.png", "/icons/icon-512px.png"]],
  ...CACHED_URLS,
]

const fetch_network_first_list = ["/config.js", ...FETCH_NETWORK_FIRST_LIST]
const cache_after_fetch_white_list = CACHE_AFTER_FETCH_INCLUDE_LIST

self.addEventListener("install", handle_install)
self.addEventListener("activate", handle_activate)
self.addEventListener("message", handle_message)
self.addEventListener("fetch", handle_fetch)
