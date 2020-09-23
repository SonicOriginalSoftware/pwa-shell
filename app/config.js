const app_info = Object.freeze({
  name: "App Name Here",
  version: "0.0.1",
})

const db_info = Object.freeze({
  name: "app-db",
  version: 1,
})

const oauth_info = Object.freeze({
  clientId: {},
  apiKey: {},
})

/** @type {Array<[String, {'name': String, 'keyPath': String}[]]>} */
const object_stores = []

/** @type {Array<[String, String[]]>} */
const CACHED_URLS = [
  ["app-components", []],
  ["framework-components", []],
  ["component", []],
  ["images", []],
  ["icons", []],
  ["core-elements", []],
  ["themes", ["/themes/default_light.css", "/themes/default_dark.css"]],
  ["indexedDB", []],
  ["apis", []],
]

/** @type {String[]} */
const FETCH_NETWORK_FIRST_LIST = []

/** @type {String[]} */
const CACHE_AFTER_FETCH_INCLUDE_LIST = []

async function pre_db_upgrade() {
  // If there's ever any data migration to do, need to collect necessary data
  // at this point from current object stores
}

async function post_db_upgrade() {
  // After any DB creation and object store creation is done, perform any
  // necessary migration
}
