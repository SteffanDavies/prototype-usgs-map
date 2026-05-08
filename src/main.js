import './style.css'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import shp from 'shpjs'

const FEEDS = {
  significant_hour: makeFeed('Significant earthquakes, past hour', 'significant_hour'),
  '4.5_hour': makeFeed('M4.5+ earthquakes, past hour', '4.5_hour'),
  '2.5_hour': makeFeed('M2.5+ earthquakes, past hour', '2.5_hour'),
  '1.0_hour': makeFeed('M1.0+ earthquakes, past hour', '1.0_hour'),
  all_hour: makeFeed('All earthquakes, past hour', 'all_hour'),
  significant_day: makeFeed('Significant earthquakes, past day', 'significant_day'),
  '4.5_day': makeFeed('M4.5+ earthquakes, past day', '4.5_day'),
  '2.5_day': makeFeed('M2.5+ earthquakes, past day', '2.5_day'),
  '1.0_day': makeFeed('M1.0+ earthquakes, past day', '1.0_day'),
  all_day: makeFeed('All earthquakes, past day', 'all_day'),
  significant_week: makeFeed('Significant earthquakes, past week', 'significant_week'),
  '4.5_week': makeFeed('M4.5+ earthquakes, past week', '4.5_week'),
  '2.5_week': makeFeed('M2.5+ earthquakes, past week', '2.5_week'),
  '1.0_week': makeFeed('M1.0+ earthquakes, past week', '1.0_week'),
  all_week: makeFeed('All earthquakes, past week', 'all_week'),
  significant_month: makeFeed('Significant earthquakes, past 30 days', 'significant_month'),
  '4.5_month': makeFeed('M4.5+ earthquakes, past 30 days', '4.5_month'),
  '2.5_month': makeFeed('M2.5+ earthquakes, past 30 days', '2.5_month'),
  '1.0_month': makeFeed('M1.0+ earthquakes, past 30 days', '1.0_month'),
  all_month: makeFeed('All earthquakes, past 30 days', 'all_month'),
}

const REFRESH_INTERVAL_MS = 60_000
const EARTHQUAKE_SOURCE_ID = 'earthquakes'
const SELECTED_SOURCE_ID = 'selected-earthquake'
const DEFAULT_FEED = 'all_month'
const SHAKEMAP_LAYER_KEYS = ['affected', 'contours', 'rupture']
const SHAKEMAP_LAYER_LABELS = {
  affected: 'Affected Area',
  contours: 'Intensity Contours',
  rupture: 'Rupture',
}
const SHAKEMAP_SOURCE_IDS = {
  affected: 'shakemap-affected',
  contours: 'shakemap-contours',
  rupture: 'shakemap-rupture',
}
const SHAKEMAP_LAYER_IDS = {
  affected: ['shakemap-affected-fill', 'shakemap-affected-line'],
  contours: ['shakemap-contours-line'],
  rupture: ['shakemap-rupture-fill', 'shakemap-rupture-line', 'shakemap-rupture-circle'],
}

const SECTION_GLOSSARY = {
  Overview: {
    intro: 'Core identifying facts about the selected earthquake event.',
    entries: [
      makeGlossaryEntry('Magnitude is the reported earthquake size for this event.', 'mag / magType', 'Summary feed, detail endpoint'),
      makeGlossaryEntry('Time values are event timestamps in the feed payload.', 'time / updated', 'Summary feed, detail endpoint'),
      makeGlossaryEntry('Coordinates are stored in GeoJSON order: longitude, latitude, depth.', 'geometry.coordinates', 'Summary feed, detail endpoint'),
    ],
  },
  Impact: {
    intro: 'Impact fields describe shaking severity, public reports, and potential hazard signals.',
    entries: [
      makeGlossaryEntry('Alert is USGS impact messaging such as green, yellow, orange, or red.', 'alert', 'Summary feed, detail endpoint'),
      makeGlossaryEntry('Tsunami indicates whether the event was flagged for tsunami relevance.', 'tsunami', 'Summary feed, detail endpoint'),
      makeGlossaryEntry('CDI and MMI are different shaking intensity measures: community-reported versus modeled/estimated.', 'cdi / mmi', 'Summary feed, detail endpoint'),
    ],
  },
  'Measurement And Quality': {
    intro: 'These fields help judge how well the earthquake was measured and constrained.',
    entries: [
      makeGlossaryEntry('NST, DMIN, RMS, and GAP are technical quality metrics from seismic processing.', 'nst / dmin / rms / gap', 'Summary feed, detail endpoint'),
      makeGlossaryEntry('BBox is a GeoJSON bounding box for the returned object or feed extent.', 'bbox', 'Summary feed, detail endpoint'),
    ],
  },
  'Source And Identifiers': {
    intro: 'Identifiers and provenance fields explain which network published the event and how USGS references it.',
    entries: [
      makeGlossaryEntry('Network and code together identify the publishing source event.', 'net / code', 'Summary feed, detail endpoint'),
      makeGlossaryEntry('IDs, sources, and types are comma-delimited references to related systems and available product families.', 'ids / sources / types', 'Summary feed, detail endpoint'),
    ],
  },
  Links: {
    intro: 'These links let you inspect the same event directly from USGS.',
    entries: [
      makeGlossaryEntry('The event page is the human-readable USGS page for the earthquake.', 'url', 'Summary feed, detail endpoint'),
      makeGlossaryEntry('The detail endpoint is the machine-readable per-event GeoJSON record with products.', 'detail', 'Summary feed'),
    ],
  },
  ShakeMap: {
    intro: 'ShakeMap assets describe estimated ground shaking for the selected earthquake. Vector layers can be toggled from the separate map layer control.',
    entries: [
      makeGlossaryEntry('Affected Area is loaded from the ShakeMap shapefile package and is best suited for overlay and spatial analysis.', 'download/shape.zip', 'Detail product metadata'),
      makeGlossaryEntry('Intensity Contours are isolines of equal shaking intensity, typically from cont_mmi.json.', 'download/cont_mmi.json', 'Detail product metadata'),
      makeGlossaryEntry('Rupture is the source geometry published with the event when available.', 'download/rupture.json', 'Detail product metadata'),
    ],
  },
  'Selected ShakeMap Feature': {
    intro: 'This section shows the properties of the currently clicked ShakeMap geometry on the map.',
    entries: [
      makeGlossaryEntry('Feature attributes vary by layer type. Intensity polygons and contours often expose intensity value, color, and weight.', 'feature.properties', 'Derived vector layer'),
    ],
  },
  'Detail Products': {
    intro: 'USGS detail products are attached data packages such as origin solutions, shakemaps, or impact summaries. Product availability varies by event.',
    entries: [
      makeGlossaryEntry('Product type names indicate the kind of auxiliary data attached to the event.', 'properties.products.<productType>', 'Detail endpoint'),
      makeGlossaryEntry('Preferred weight helps USGS choose a preferred product when multiple contributors publish the same product type.', 'preferredWeight', 'Detail product metadata'),
      makeGlossaryEntry('Contents lists files or resources attached to a product, often with downloadable URLs.', 'contents', 'Detail product metadata'),
    ],
  },
  'Raw JSON': {
    intro: 'This section shows the unformatted USGS payload exactly as returned by the API.',
    entries: [
      makeGlossaryEntry('Use the formatted sections above to interpret terse raw keys before reading the JSON directly.', 'raw payload', 'Summary feed, detail endpoint'),
      makeGlossaryEntry('The summary JSON is the event record from the selected feed. The detail JSON is the expanded per-event response.', 'feature / detail response', 'Summary feed, detail endpoint'),
    ],
  },
}

const FIELD_GLOSSARY = {
  Place: makeGlossaryEntry('Human-readable location text describing where the earthquake occurred relative to a known place.', 'place', 'Summary feed, detail endpoint'),
  'Event ID': makeGlossaryEntry('Stable USGS event identifier for this earthquake record.', 'id', 'Summary feed, detail endpoint'),
  'Event type': makeGlossaryEntry('Classification of the event, usually earthquake but sometimes quarry blast or other seismic event type.', 'type', 'Summary feed, detail endpoint'),
  Magnitude: makeGlossaryEntry('Reported earthquake size for the preferred solution.', 'mag', 'Summary feed, detail endpoint'),
  'Magnitude type': makeGlossaryEntry('Method used to compute magnitude, such as mb, ml, mw, or mww.', 'magType', 'Summary feed, detail endpoint'),
  'Event time': makeGlossaryEntry('When the earthquake occurred.', 'time', 'Summary feed, detail endpoint'),
  'Last updated': makeGlossaryEntry('When USGS last updated this event record.', 'updated', 'Summary feed, detail endpoint'),
  Depth: makeGlossaryEntry('Earthquake depth below the surface in kilometers.', 'geometry.coordinates[2]', 'Summary feed, detail endpoint'),
  Latitude: makeGlossaryEntry('Latitude of the event epicenter.', 'geometry.coordinates[1]', 'Summary feed, detail endpoint'),
  Longitude: makeGlossaryEntry('Longitude of the event epicenter.', 'geometry.coordinates[0]', 'Summary feed, detail endpoint'),
  'Timezone offset': makeGlossaryEntry('Legacy timezone offset field in minutes when provided by USGS.', 'tz', 'Summary feed, detail endpoint'),
  'Alert level': makeGlossaryEntry('USGS impact alert level, when estimated losses or shaking merit color-coded messaging.', 'alert', 'Summary feed, detail endpoint'),
  Tsunami: makeGlossaryEntry('Indicates whether the event has tsunami significance in USGS processing.', 'tsunami', 'Summary feed, detail endpoint'),
  'Felt reports': makeGlossaryEntry('Number of “Did You Feel It?” public reports associated with this event.', 'felt', 'Summary feed, detail endpoint'),
  CDI: makeGlossaryEntry('Community Determined Intensity from public shaking reports.', 'cdi', 'Summary feed, detail endpoint'),
  MMI: makeGlossaryEntry('Modified Mercalli Intensity, an estimate of shaking severity.', 'mmi', 'Summary feed, detail endpoint'),
  Significance: makeGlossaryEntry('USGS significance score used for sorting and importance weighting.', 'sig', 'Summary feed, detail endpoint'),
  NST: makeGlossaryEntry('Number of seismic stations used in the event solution.', 'nst', 'Summary feed, detail endpoint'),
  DMIN: makeGlossaryEntry('Distance from the event to the nearest station, in degrees.', 'dmin', 'Summary feed, detail endpoint'),
  RMS: makeGlossaryEntry('Root mean square of travel time residuals, a fit-quality metric.', 'rms', 'Summary feed, detail endpoint'),
  GAP: makeGlossaryEntry('Largest azimuthal gap between stations, used as a geometry quality indicator.', 'gap', 'Summary feed, detail endpoint'),
  Status: makeGlossaryEntry('Processing status of the event record.', 'status', 'Summary feed, detail endpoint'),
  BBox: makeGlossaryEntry('GeoJSON bounding box describing the spatial extent of the returned object.', 'bbox', 'Summary feed, detail endpoint'),
  Network: makeGlossaryEntry('Publishing seismic network identifier.', 'net', 'Summary feed, detail endpoint'),
  Code: makeGlossaryEntry('Network-specific event code.', 'code', 'Summary feed, detail endpoint'),
  IDs: makeGlossaryEntry('Comma-delimited alternate identifiers associated with this event.', 'ids', 'Summary feed, detail endpoint'),
  Sources: makeGlossaryEntry('Comma-delimited list of contributing source networks.', 'sources', 'Summary feed, detail endpoint'),
  Types: makeGlossaryEntry('Comma-delimited list of available USGS product types for the event.', 'types', 'Summary feed, detail endpoint'),
  'USGS event page': makeGlossaryEntry('Human-readable USGS event webpage.', 'url', 'Summary feed, detail endpoint'),
  'USGS detail endpoint': makeGlossaryEntry('Machine-readable USGS GeoJSON detail record used to fetch products.', 'detail', 'Summary feed'),
  'Product source': makeGlossaryEntry('Publisher of the preferred ShakeMap product.', 'source', 'Detail product metadata'),
  'Product code': makeGlossaryEntry('Code associated with the preferred ShakeMap product.', 'code', 'Detail product metadata'),
  'Product status': makeGlossaryEntry('Lifecycle state for the preferred ShakeMap product.', 'status', 'Detail product metadata'),
  'Product update': makeGlossaryEntry('When the preferred ShakeMap product was last updated.', 'updateTime', 'Detail product metadata'),
  Source: makeGlossaryEntry('Producer of the detail product entry.', 'source', 'Detail product metadata'),
  'Update time': makeGlossaryEntry('When the product entry was last updated.', 'updateTime', 'Detail product metadata'),
  'Preferred weight': makeGlossaryEntry('Ranking hint used to determine the preferred product among competing versions.', 'preferredWeight', 'Detail product metadata'),
  'Content type': makeGlossaryEntry('Mime type for a product attachment or linked asset.', 'contents.<path>.contentType', 'Detail product metadata'),
  Length: makeGlossaryEntry('Size of a product content asset in bytes.', 'contents.<path>.length', 'Detail product metadata'),
  URL: makeGlossaryEntry('Direct link to a product attachment or related resource.', 'contents.<path>.url', 'Detail product metadata'),
}

const INLINE_HELP_FIELDS = new Set(['CDI', 'MMI', 'NST', 'DMIN', 'RMS', 'GAP'])

const feedSelect = document.querySelector('#feed-select')
const statusText = document.querySelector('#status-text')
const updatedAt = document.querySelector('#updated-at')
const quakeCount = document.querySelector('#quake-count')
const selectionTitle = document.querySelector('#selection-title')
const selectionSubtitle = document.querySelector('#selection-subtitle')
const selectionPresence = document.querySelector('#selection-presence')
const detailStatus = document.querySelector('#detail-status')
const detailsContent = document.querySelector('#details-content')
const sidePanel = document.querySelector('#side-panel')
const panelToggle = document.querySelector('#panel-toggle')
const layerControlToggle = document.querySelector('#layer-control-toggle')
const layerControlPanel = document.querySelector('#layer-control-panel')
const layerControlStatus = document.querySelector('#layer-control-status')
const layerInputs = {
  affected: document.querySelector('#toggle-affected'),
  contours: document.querySelector('#toggle-contours'),
  rupture: document.querySelector('#toggle-rupture'),
}

let refreshTimer
let hoverPopup = null
let shakeMapHoverPopup = null
let activeFeed = DEFAULT_FEED
let latestFeedData = emptyFeatureCollection()
let selectionRequestId = 0

const selectionState = {
  feature: null,
  detail: null,
  detailState: 'idle',
  detailError: '',
  presentInActiveFeed: false,
}

const shakeMapState = createEmptyShakeMapState()

populateFeedOptions()
feedSelect.value = DEFAULT_FEED

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [15, 20],
  zoom: 1.5,
  attributionControl: true,
})

map.addControl(new maplibregl.NavigationControl(), 'top-right')

panelToggle.addEventListener('click', () => {
  const collapsed = sidePanel.classList.toggle('panel-collapsed')
  panelToggle.textContent = collapsed ? 'Show Feed' : 'Hide Feed'
  panelToggle.setAttribute('aria-expanded', String(!collapsed))
  window.setTimeout(() => map.resize(), 180)
})

layerControlToggle.addEventListener('click', () => {
  const expanded = layerControlPanel.hidden
  layerControlPanel.hidden = !expanded
  layerControlToggle.setAttribute('aria-expanded', String(expanded))
})

Object.entries(layerInputs).forEach(([kind, input]) => {
  input.addEventListener('change', async (event) => {
    await setShakeMapLayerEnabled(kind, event.target.checked)
  })
})

map.on('load', async () => {
  map.addSource(EARTHQUAKE_SOURCE_ID, {
    type: 'geojson',
    data: latestFeedData,
    generateId: true,
  })

  map.addSource(SELECTED_SOURCE_ID, {
    type: 'geojson',
    data: emptyFeatureCollection(),
  })

  SHAKEMAP_LAYER_KEYS.forEach((kind) => {
    map.addSource(SHAKEMAP_SOURCE_IDS[kind], {
      type: 'geojson',
      data: emptyFeatureCollection(),
    })
  })

  map.addLayer({
    id: 'earthquake-glow',
    type: 'circle',
    source: EARTHQUAKE_SOURCE_ID,
    paint: {
      'circle-radius': magnitudeRadius([8, 14, 24, 36]),
      'circle-color': '#f04d3a',
      'circle-opacity': 0.08,
    },
  })

  map.addLayer({
    id: 'earthquake-circles',
    type: 'circle',
    source: EARTHQUAKE_SOURCE_ID,
    paint: {
      'circle-color': magnitudeColor(),
      'circle-radius': magnitudeRadius([4, 8, 14, 20]),
      'circle-opacity': 0.82,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff',
    },
  })

  map.addLayer({
    id: 'selected-earthquake-ring',
    type: 'circle',
    source: SELECTED_SOURCE_ID,
    paint: {
      'circle-radius': magnitudeRadius([12, 18, 26, 34]),
      'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': '#10243d',
      'circle-stroke-width': 2.5,
    },
  })

  map.addLayer({
    id: 'selected-earthquake-core',
    type: 'circle',
    source: SELECTED_SOURCE_ID,
    paint: {
      'circle-radius': magnitudeRadius([4, 8, 14, 20]),
      'circle-color': magnitudeColor(),
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  })

  addShakeMapLayers()
  bindMapInteractions()

  await refreshFeed()
  startPolling()
})

feedSelect.addEventListener('change', async (event) => {
  activeFeed = event.target.value
  statusText.textContent = `Switching to ${FEEDS[activeFeed].label.toLowerCase()}...`
  await refreshFeed()
  startPolling()
})

renderSelectionPanel()
renderLayerControl()

async function refreshFeed() {
  const source = map.getSource(EARTHQUAKE_SOURCE_ID)
  if (!source) {
    return
  }

  try {
    statusText.textContent = 'Fetching latest earthquakes...'

    const response = await fetch(FEEDS[activeFeed].url, {
      headers: {
        Accept: 'application/geo+json, application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`USGS request failed with ${response.status}`)
    }

    const data = await response.json()
    latestFeedData = data
    source.setData(data)
    quakeCount.textContent = String(data.features.length)
    updatedAt.textContent = formatTime(Date.now())
    statusText.textContent = `Showing ${FEEDS[activeFeed].label.toLowerCase()}.`
    syncSelectionToFeed(data)
  } catch (error) {
    console.error(error)
    statusText.textContent = 'Unable to refresh earthquake data right now.'
  }
}

function syncSelectionToFeed(data) {
  if (!selectionState.feature) {
    return
  }

  const nextFeature = data.features.find((feature) => feature.id === selectionState.feature.id)
  selectionState.presentInActiveFeed = Boolean(nextFeature)

  if (nextFeature) {
    selectionState.feature = nextFeature
    updateSelectedSource()
  }

  renderSelectionPanel()
}

function selectFeature(feature) {
  selectionRequestId += 1
  selectionState.feature = feature
  selectionState.detail = null
  selectionState.detailState = 'loading'
  selectionState.detailError = ''
  selectionState.presentInActiveFeed = true
  updateSelectedSource()
  resetShakeMapState('Loading ShakeMap assets for the selected earthquake...')
  renderSelectionPanel()
  renderLayerControl()
  loadFeatureDetail(feature, selectionRequestId)
}

async function loadFeatureDetail(feature, requestId) {
  const detailUrl = feature.properties?.detail
  if (!detailUrl) {
    selectionState.detailState = 'error'
    selectionState.detailError = 'No detail endpoint was provided for this event.'
    resetShakeMapState('No ShakeMap data available because the event detail endpoint is missing.')
    renderSelectionPanel()
    renderLayerControl()
    return
  }

  try {
    const response = await fetch(detailUrl, {
      headers: {
        Accept: 'application/geo+json, application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Detail request failed with ${response.status}`)
    }

    const detail = await response.json()
    if (requestId !== selectionRequestId) {
      return
    }

    selectionState.detail = detail
    selectionState.detailState = 'success'
    selectionState.detailError = ''
    await configureShakeMap(detail, requestId)
    renderSelectionPanel()
    renderLayerControl()
  } catch (error) {
    console.error(error)
    if (requestId !== selectionRequestId) {
      return
    }

    selectionState.detail = null
    selectionState.detailState = 'error'
    selectionState.detailError = error.message
    resetShakeMapState('Detail request failed before ShakeMap assets could be inspected.')
    renderSelectionPanel()
    renderLayerControl()
  }
}

async function configureShakeMap(detail, requestId) {
  resetShakeMapState('Inspecting ShakeMap product contents...')

  const product = getPreferredShakeMapProduct(detail)
  if (!product) {
    shakeMapState.status = 'No ShakeMap is available for this earthquake.'
    renderSelectionPanel()
    renderLayerControl()
    return
  }

  shakeMapState.product = product
  shakeMapState.assets = classifyShakeMapAssets(product.contents ?? {})
  shakeMapState.available = Object.values(shakeMapState.assets).some(Boolean)
  shakeMapState.status = shakeMapState.available
    ? 'ShakeMap vector assets are available. Toggle them from this layer control.'
    : 'ShakeMap exists for this event, but no supported vector layers were detected.'
  shakeMapState.toggles = {
    affected: Boolean(shakeMapState.assets.affected),
    contours: false,
    rupture: false,
  }

  renderSelectionPanel()
  renderLayerControl()

  if (requestId !== selectionRequestId) {
    return
  }

  if (shakeMapState.toggles.affected) {
    await setShakeMapLayerEnabled('affected', true)
  }
}

async function setShakeMapLayerEnabled(kind, enabled) {
  if (!shakeMapState.assets[kind]) {
    shakeMapState.toggles[kind] = false
    renderLayerControl()
    return
  }

  shakeMapState.toggles[kind] = enabled

  if (!enabled) {
    setMapLayerVisibility(kind, false)
    if (shakeMapState.selectedFeature?.kind === kind) {
      shakeMapState.selectedFeature = null
      renderSelectionPanel()
    }
    renderLayerControl()
    return
  }

  try {
    layerControlStatus.textContent = `Loading ${SHAKEMAP_LAYER_LABELS[kind].toLowerCase()}...`
    renderLayerControl()
    await ensureShakeMapLayerLoaded(kind)
    setMapLayerVisibility(kind, true)
    shakeMapState.status = `${SHAKEMAP_LAYER_LABELS[kind]} is visible.`
  } catch (error) {
    console.error(error)
    shakeMapState.toggles[kind] = false
    shakeMapState.status = `Unable to load ${SHAKEMAP_LAYER_LABELS[kind].toLowerCase()} right now.`
  }

  renderSelectionPanel()
  renderLayerControl()
}

async function ensureShakeMapLayerLoaded(kind) {
  if (shakeMapState.data[kind]) {
    return
  }

  if (shakeMapState.loading[kind]) {
    await shakeMapState.loading[kind]
    return
  }

  const url = shakeMapState.assets[kind]
  if (!url) {
    throw new Error(`No asset URL configured for ${kind}`)
  }

  shakeMapState.loading[kind] = loadShakeMapData(kind, url)
  const data = await shakeMapState.loading[kind]
  shakeMapState.data[kind] = data
  shakeMapState.loading[kind] = null
  setShakeMapSourceData(kind, data)
}

async function loadShakeMapData(kind, url) {
  if (kind === 'affected') {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`ShakeMap asset request failed with ${response.status}`)
    }

    const buffer = await response.arrayBuffer()
    const parsed = await shp(buffer)
    const collection = extractAffectedCollection(parsed)
    return normalizeShakeMapFeatureCollection(collection, kind)
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/geo+json, application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`ShakeMap asset request failed with ${response.status}`)
  }

  const data = await response.json()
  return normalizeShakeMapFeatureCollection(data, kind)
}

function extractAffectedCollection(parsed) {
  if (parsed?.type === 'FeatureCollection') {
    return parsed
  }

  if (Array.isArray(parsed)) {
    return parsed.find((item) => item?.type === 'FeatureCollection') ?? emptyFeatureCollection()
  }

  if (parsed && typeof parsed === 'object') {
    const preferredEntry = Object.entries(parsed).find(([key, value]) => key.toLowerCase() === 'mi' && value?.type === 'FeatureCollection')
    if (preferredEntry) {
      return preferredEntry[1]
    }

    const firstCollection = Object.values(parsed).find((value) => value?.type === 'FeatureCollection')
    if (firstCollection) {
      return firstCollection
    }
  }

  return emptyFeatureCollection()
}

function normalizeShakeMapFeatureCollection(collection, kind) {
  const features = (collection?.features ?? []).map((feature, index) => {
    const properties = feature.properties ?? {}
    const displayValue = resolveShakeMapValue(properties)
    return {
      ...feature,
      properties: {
        ...properties,
        __featureId: properties.id ?? `${kind}-${index}`,
        __layerKind: kind,
        __displayValue: displayValue,
        __displayLabel: describeShakeMapFeature(kind, properties, displayValue),
        __displayColor: properties.color ?? colorForShakeMapValue(displayValue),
        __displayWeight: normalizeNumber(properties.weight) ?? 2,
      },
    }
  })

  return {
    type: 'FeatureCollection',
    features,
  }
}

function bindMapInteractions() {
  map.on('mouseenter', 'earthquake-circles', (event) => {
    map.getCanvas().style.cursor = 'pointer'
    showEarthquakeHoverPopup(event)
  })

  map.on('mousemove', 'earthquake-circles', (event) => {
    showEarthquakeHoverPopup(event)
  })

  map.on('mouseleave', 'earthquake-circles', () => {
    map.getCanvas().style.cursor = ''
    clearEarthquakeHoverPopup()
  })

  map.on('click', 'earthquake-circles', (event) => {
    const feature = event.features?.[0]
    if (!feature) {
      return
    }

    clearEarthquakeHoverPopup()
    selectFeature(feature)
  })

  Object.entries(SHAKEMAP_LAYER_IDS).forEach(([kind, layerIds]) => {
    layerIds.forEach((layerId) => {
      map.on('mouseenter', layerId, (event) => {
        map.getCanvas().style.cursor = 'pointer'
        showShakeMapHoverPopup(event, kind)
      })

      map.on('mousemove', layerId, (event) => {
        showShakeMapHoverPopup(event, kind)
      })

      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = ''
        clearShakeMapHoverPopup()
      })

      map.on('click', layerId, (event) => {
        const feature = event.features?.[0]
        if (!feature) {
          return
        }

        clearShakeMapHoverPopup()
        shakeMapState.selectedFeature = {
          kind,
          geometryType: feature.geometry?.type ?? 'Unknown geometry',
          properties: feature.properties ?? {},
        }
        renderSelectionPanel()
      })
    })
  })
}

function addShakeMapLayers() {
  map.addLayer({
    id: 'shakemap-affected-fill',
    type: 'fill',
    source: SHAKEMAP_SOURCE_IDS.affected,
    layout: { visibility: 'none' },
    paint: {
      'fill-color': ['coalesce', ['get', '__displayColor'], '#f0b43c'],
      'fill-opacity': 0.34,
    },
  })

  map.addLayer({
    id: 'shakemap-affected-line',
    type: 'line',
    source: SHAKEMAP_SOURCE_IDS.affected,
    layout: { visibility: 'none' },
    paint: {
      'line-color': ['coalesce', ['get', '__displayColor'], '#8a5a12'],
      'line-width': 1.5,
      'line-opacity': 0.85,
    },
  })

  map.addLayer({
    id: 'shakemap-contours-line',
    type: 'line',
    source: SHAKEMAP_SOURCE_IDS.contours,
    layout: { visibility: 'none' },
    paint: {
      'line-color': ['coalesce', ['get', '__displayColor'], '#245ec7'],
      'line-width': ['coalesce', ['get', '__displayWeight'], 2],
      'line-opacity': 0.9,
    },
  })

  map.addLayer({
    id: 'shakemap-rupture-fill',
    type: 'fill',
    source: SHAKEMAP_SOURCE_IDS.rupture,
    layout: { visibility: 'none' },
    paint: {
      'fill-color': '#992247',
      'fill-opacity': 0.18,
    },
  })

  map.addLayer({
    id: 'shakemap-rupture-line',
    type: 'line',
    source: SHAKEMAP_SOURCE_IDS.rupture,
    layout: { visibility: 'none' },
    paint: {
      'line-color': '#992247',
      'line-width': 3,
      'line-opacity': 0.95,
    },
  })

  map.addLayer({
    id: 'shakemap-rupture-circle',
    type: 'circle',
    source: SHAKEMAP_SOURCE_IDS.rupture,
    layout: { visibility: 'none' },
    paint: {
      'circle-color': '#992247',
      'circle-radius': 5,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1.5,
    },
  })
}

function showEarthquakeHoverPopup(event) {
  const feature = event.features?.[0]
  if (!feature) {
    return
  }

  const coordinates = feature.geometry.coordinates.slice(0, 2)
  const place = feature.properties.place ?? 'Unknown location'
  const magnitude = formatMagnitude(feature.properties.mag)
  const time = formatTime(feature.properties.time)

  if (!hoverPopup) {
    hoverPopup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 14,
    })
  }

  hoverPopup
    .setLngLat(coordinates)
    .setHTML(`
      <article class="popup">
        <p class="popup-kicker">Magnitude ${escapeHtml(magnitude)}</p>
        <h2>${escapeHtml(place)}</h2>
        <p>${escapeHtml(time)}</p>
      </article>
    `)
    .addTo(map)
}

function showShakeMapHoverPopup(event, kind) {
  const feature = event.features?.[0]
  if (!feature) {
    return
  }

  const label = feature.properties?.__displayLabel ?? SHAKEMAP_LAYER_LABELS[kind]

  if (!shakeMapHoverPopup) {
    shakeMapHoverPopup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
    })
  }

  shakeMapHoverPopup
    .setLngLat(event.lngLat)
    .setHTML(`
      <article class="popup">
        <p class="popup-kicker">${escapeHtml(SHAKEMAP_LAYER_LABELS[kind])}</p>
        <h2>${escapeHtml(label)}</h2>
      </article>
    `)
    .addTo(map)
}

function clearEarthquakeHoverPopup() {
  hoverPopup?.remove()
  hoverPopup = null
}

function clearShakeMapHoverPopup() {
  shakeMapHoverPopup?.remove()
  shakeMapHoverPopup = null
}

function updateSelectedSource() {
  const selectedSource = map.getSource(SELECTED_SOURCE_ID)
  if (!selectedSource) {
    return
  }

  if (!selectionState.feature) {
    selectedSource.setData(emptyFeatureCollection())
    return
  }

  selectedSource.setData({
    type: 'FeatureCollection',
    features: [selectionState.feature],
  })
}

function setShakeMapSourceData(kind, data) {
  const source = map.getSource(SHAKEMAP_SOURCE_IDS[kind])
  source?.setData(data)
}

function setMapLayerVisibility(kind, visible) {
  SHAKEMAP_LAYER_IDS[kind].forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
    }
  })
}

function resetShakeMapState(statusMessage) {
  clearShakeMapHoverPopup()
  Object.assign(shakeMapState, createEmptyShakeMapState())
  shakeMapState.status = statusMessage

  SHAKEMAP_LAYER_KEYS.forEach((kind) => {
    setMapLayerVisibility(kind, false)
    setShakeMapSourceData(kind, emptyFeatureCollection())
  })
}

function renderSelectionPanel() {
  const feature = selectionState.feature

  if (!feature) {
    selectionTitle.textContent = 'Inspect USGS event data'
    selectionSubtitle.textContent = 'Select an earthquake on the map to inspect summary fields, detail products, raw JSON, and any ShakeMap vector layers.'
    detailStatus.textContent = 'No earthquake selected.'
    detailStatus.className = 'banner banner-muted'
    selectionPresence.hidden = true
    detailsContent.innerHTML = ''
    return
  }

  const summaryProperties = feature.properties ?? {}
  const detailProperties = selectionState.detail?.properties ?? {}
  const mergedProperties = { ...summaryProperties, ...detailProperties }
  const coordinates = feature.geometry?.coordinates ?? []

  selectionTitle.textContent = summaryProperties.place ?? feature.id ?? 'Selected event'
  selectionSubtitle.textContent = `Event ID ${feature.id ?? 'unknown'}${summaryProperties.type ? `, type ${summaryProperties.type}` : ''}`

  if (selectionState.presentInActiveFeed) {
    selectionPresence.hidden = true
  } else {
    selectionPresence.hidden = false
    selectionPresence.textContent = 'This earthquake is no longer present in the active feed. Showing the last selected data.'
    selectionPresence.className = 'banner banner-warning'
  }

  if (selectionState.detailState === 'loading') {
    detailStatus.textContent = 'Loading detail endpoint and product metadata from USGS...'
    detailStatus.className = 'banner'
  } else if (selectionState.detailState === 'error') {
    detailStatus.textContent = `Detail request failed: ${selectionState.detailError}`
    detailStatus.className = 'banner banner-error'
  } else if (selectionState.detailState === 'success') {
    detailStatus.textContent = 'Summary feed and detail endpoint loaded.'
    detailStatus.className = 'banner banner-muted'
  } else {
    detailStatus.textContent = 'Summary feed loaded.'
    detailStatus.className = 'banner banner-muted'
  }

  const sections = [
    renderFieldSection('Overview', [
      makeRow('Place', summaryProperties.place),
      makeRow('Event ID', feature.id),
      makeRow('Event type', mergedProperties.type),
      makeRow('Magnitude', formatMagnitude(mergedProperties.mag)),
      makeRow('Magnitude type', mergedProperties.magType),
      makeRow('Event time', formatTime(mergedProperties.time)),
      makeRow('Last updated', formatTime(mergedProperties.updated)),
      makeRow('Depth', formatDepth(coordinates[2])),
      makeRow('Latitude', formatCoordinate(coordinates[1])),
      makeRow('Longitude', formatCoordinate(coordinates[0])),
      makeRow('Timezone offset', formatMaybeNumber(mergedProperties.tz)),
    ]),
    renderFieldSection('Impact', [
      makeRow('Alert level', mergedProperties.alert),
      makeRow('Tsunami', formatTsunami(mergedProperties.tsunami)),
      makeRow('Felt reports', formatMaybeNumber(mergedProperties.felt)),
      makeRow('CDI', formatMaybeNumber(mergedProperties.cdi)),
      makeRow('MMI', formatMaybeNumber(mergedProperties.mmi)),
      makeRow('Significance', formatMaybeNumber(mergedProperties.sig)),
    ]),
    renderFieldSection('Measurement And Quality', [
      makeRow('NST', formatMaybeNumber(mergedProperties.nst)),
      makeRow('DMIN', formatMaybeNumber(mergedProperties.dmin)),
      makeRow('RMS', formatMaybeNumber(mergedProperties.rms)),
      makeRow('GAP', formatMaybeNumber(mergedProperties.gap)),
      makeRow('Status', mergedProperties.status),
      makeRow('BBox', formatBbox(selectionState.detail?.bbox ?? latestFeedData.bbox)),
    ]),
    renderFieldSection('Source And Identifiers', [
      makeRow('Network', mergedProperties.net),
      makeRow('Code', mergedProperties.code),
      makeRow('IDs', mergedProperties.ids),
      makeRow('Sources', mergedProperties.sources),
      makeRow('Types', mergedProperties.types),
    ]),
    renderLinksSection('Links', [
      makeRow('USGS event page', mergedProperties.url),
      makeRow('USGS detail endpoint', summaryProperties.detail),
    ]),
    renderFieldSection('ShakeMap', buildShakeMapRows()),
    renderLinksSection('ShakeMap Assets', buildShakeMapAssetRows()),
    renderFieldSection('Selected ShakeMap Feature', buildSelectedShakeMapFeatureRows()),
    renderProductsSection(selectionState.detail?.properties?.products ?? null),
    renderJsonSection('Raw JSON', [
      ['Summary feature JSON', feature],
      ['Detail response JSON', selectionState.detail],
    ]),
  ]

  detailsContent.innerHTML = sections.filter(Boolean).join('')
}

function renderLayerControl() {
  const selected = selectionState.feature

  if (!selected) {
    layerControlStatus.textContent = 'Select an earthquake with ShakeMap data.'
  } else {
    layerControlStatus.textContent = shakeMapState.status
  }

  SHAKEMAP_LAYER_KEYS.forEach((kind) => {
    const input = layerInputs[kind]
    input.disabled = !shakeMapState.assets[kind]
    input.checked = Boolean(shakeMapState.toggles[kind] && shakeMapState.assets[kind])
  })
}

function renderFieldSection(title, rows) {
  const renderedRows = rows
    .filter(({ value }) => value !== undefined && value !== null && value !== '')
    .map(({ label, value, helpKey }) => `
      <div class="field-row">
        <div class="field-label-row">
          <div class="field-label">${escapeHtml(label)}</div>
          ${renderInlineHelp(helpKey ?? label)}
        </div>
        <div class="field-value">${escapeHtml(stringifyValue(value))}</div>
      </div>
    `)
    .join('')

  if (!renderedRows) {
    return ''
  }

  return `
    <section class="section-card">
      ${renderSectionHeader(title)}
      <div class="field-grid">${renderedRows}</div>
    </section>
  `
}

function renderLinksSection(title, rows) {
  const renderedRows = rows
    .filter(({ value }) => value)
    .map(({ label, value, helpKey }) => `
      <div class="field-row">
        <div class="field-label-row">
          <div class="field-label">${escapeHtml(label)}</div>
          ${renderInlineHelp(helpKey ?? label)}
        </div>
        <div class="field-value field-links"><a href="${escapeAttribute(value)}" target="_blank" rel="noreferrer">${escapeHtml(value)}</a></div>
      </div>
    `)
    .join('')

  if (!renderedRows) {
    return ''
  }

  return `
    <section class="section-card">
      ${renderSectionHeader(title)}
      <div class="field-grid">${renderedRows}</div>
    </section>
  `
}

function renderProductsSection(products) {
  if (!products || typeof products !== 'object' || Object.keys(products).length === 0) {
    return ''
  }

  const productBlocks = Object.entries(products)
    .map(([productType, entries]) => {
      const entryList = Array.isArray(entries) ? entries : []
      return entryList
        .map((entry, index) => {
          const propertyRows = Object.entries(entry.properties ?? {})
            .map(([key, value]) => `
              <div class="field-row">
                <div class="field-label-row">
                  <div class="field-label">${escapeHtml(key)}</div>
                </div>
                <div class="field-value">${escapeHtml(stringifyValue(value))}</div>
              </div>
            `)
            .join('')

          const contents = Object.entries(entry.contents ?? {})
            .map(([path, content]) => `
              <div class="content-item">
                <span class="content-path">${escapeHtml(path)}</span>
                <div class="field-grid">
                  ${content.contentType ? renderInlineField('Content type', content.contentType) : ''}
                  ${content.lastModified ? renderInlineField('Last modified', formatTime(content.lastModified)) : ''}
                  ${content.length !== undefined ? renderInlineField('Length', String(content.length)) : ''}
                  ${content.url ? `<div class="field-row"><div class="field-label">URL</div><div class="field-value"><a href="${escapeAttribute(content.url)}" target="_blank" rel="noreferrer">${escapeHtml(content.url)}</a></div></div>` : ''}
                </div>
              </div>
            `)
            .join('')

          return `
            <article class="product-block">
              <h3>${escapeHtml(productType)} ${entryList.length > 1 ? `#${index + 1}` : ''}</h3>
              <div class="product-meta field-grid">
                ${renderInlineField('Source', entry.source)}
                ${renderInlineField('Code', entry.code)}
                ${renderInlineField('Status', entry.status)}
                ${renderInlineField('Update time', formatTime(entry.updateTime))}
                ${renderInlineField('Preferred weight', formatMaybeNumber(entry.preferredWeight))}
              </div>
              ${propertyRows ? `<div class="field-grid">${propertyRows}</div>` : ''}
              ${contents ? `<div class="content-list">${contents}</div>` : ''}
            </article>
          `
        })
        .join('')
    })
    .join('')

  if (!productBlocks) {
    return ''
  }

  return `
    <section class="section-card">
      ${renderSectionHeader('Detail Products')}
      <div class="field-grid">${productBlocks}</div>
    </section>
  `
}

function renderJsonSection(title, blocks) {
  const renderedBlocks = blocks
    .filter(([, value]) => value)
    .map(([label, value]) => `
      <details>
        <summary>${escapeHtml(label)}</summary>
        <pre class="json-block"><code>${escapeHtml(JSON.stringify(value, null, 2))}</code></pre>
      </details>
    `)
    .join('')

  if (!renderedBlocks) {
    return ''
  }

  return `
    <section class="section-card">
      ${renderSectionHeader(title)}
      <p class="section-note">This is the unformatted USGS payload. Use the formatted sections and help cards above to interpret the terse field names.</p>
      <div class="json-shell">${renderedBlocks}</div>
    </section>
  `
}

function renderInlineField(label, value, helpKey = label) {
  if (value === undefined || value === null || value === '') {
    return ''
  }

  return `
    <div class="field-row">
      <div class="field-label-row">
        <div class="field-label">${escapeHtml(label)}</div>
        ${renderInlineHelp(helpKey)}
      </div>
      <div class="field-value">${escapeHtml(stringifyValue(value))}</div>
    </div>
  `
}

function renderSectionHeader(title) {
  const help = renderSectionHelp(title)

  return `
    <div class="section-header">
      <h3>${escapeHtml(title)}</h3>
      ${help}
    </div>
  `
}

function renderSectionHelp(title) {
  const glossary = SECTION_GLOSSARY[title]
  if (!glossary) {
    return ''
  }

  const entries = glossary.entries
    .map((entry) => renderGlossaryEntry(entry))
    .join('')

  return `
    <details class="help-block">
      <summary class="help-toggle" aria-label="Explain ${escapeAttribute(title)}">?</summary>
      <div class="help-card">
        <p class="help-intro">${escapeHtml(glossary.intro)}</p>
        <div class="help-entry-list">${entries}</div>
      </div>
    </details>
  `
}

function renderInlineHelp(helpKey) {
  if (!INLINE_HELP_FIELDS.has(helpKey)) {
    return ''
  }

  const glossary = FIELD_GLOSSARY[helpKey]
  if (!glossary) {
    return ''
  }

  return `
    <details class="inline-help">
      <summary class="inline-help-toggle" aria-label="Explain ${escapeAttribute(helpKey)}">?</summary>
      <div class="inline-help-card">${renderGlossaryEntry(glossary)}</div>
    </details>
  `
}

function renderGlossaryEntry(entry) {
  return `
    <div class="help-entry">
      <p class="help-body">${escapeHtml(entry.description)}</p>
      <p class="help-meta"><span>USGS field:</span> <code>${escapeHtml(entry.fieldKey)}</code></p>
      <p class="help-meta"><span>Source:</span> ${escapeHtml(entry.source)}</p>
    </div>
  `
}

function buildShakeMapRows() {
  const rows = [
    makeRow('Availability', shakeMapState.product ? (shakeMapState.available ? 'Vector assets available' : 'Product available, but no supported vectors found') : 'No ShakeMap available'),
    makeRow('Visible layers', visibleShakeMapLayerLabels()),
    makeRow('Product source', shakeMapState.product?.source, 'Product source'),
    makeRow('Product code', shakeMapState.product?.code, 'Product code'),
    makeRow('Product status', shakeMapState.product?.status, 'Product status'),
    makeRow('Product update', formatTime(shakeMapState.product?.updateTime), 'Product update'),
  ]

  return rows
}

function buildShakeMapAssetRows() {
  return SHAKEMAP_LAYER_KEYS
    .filter((kind) => shakeMapState.assets[kind])
    .map((kind) => makeRow(SHAKEMAP_LAYER_LABELS[kind], shakeMapState.assets[kind]))
}

function buildSelectedShakeMapFeatureRows() {
  if (!shakeMapState.selectedFeature) {
    return []
  }

  const rows = [
    makeRow('Layer', SHAKEMAP_LAYER_LABELS[shakeMapState.selectedFeature.kind]),
    makeRow('Geometry type', shakeMapState.selectedFeature.geometryType),
  ]

  Object.entries(shakeMapState.selectedFeature.properties)
    .filter(([key]) => !key.startsWith('__'))
    .forEach(([key, value]) => {
      rows.push(makeRow(key, value))
    })

  return rows
}

function visibleShakeMapLayerLabels() {
  const visible = SHAKEMAP_LAYER_KEYS.filter((kind) => shakeMapState.toggles[kind])
  if (visible.length === 0) {
    return 'None enabled'
  }

  return visible.map((kind) => SHAKEMAP_LAYER_LABELS[kind]).join(', ')
}

function getPreferredShakeMapProduct(detail) {
  const entries = detail?.properties?.products?.shakemap
  if (!Array.isArray(entries) || entries.length === 0) {
    return null
  }

  return [...entries].sort((left, right) => {
    return (right.preferredWeight ?? 0) - (left.preferredWeight ?? 0) || (right.updateTime ?? 0) - (left.updateTime ?? 0)
  })[0]
}

function classifyShakeMapAssets(contents) {
  return {
    affected: contents['download/shape.zip']?.url ?? null,
    contours: contents['download/cont_mmi.json']?.url ?? contents['download/cont_mi.json']?.url ?? null,
    rupture: contents['download/rupture.json']?.url ?? null,
  }
}

function createEmptyShakeMapState() {
  return {
    available: false,
    status: 'Select an earthquake with ShakeMap data.',
    product: null,
    assets: {
      affected: null,
      contours: null,
      rupture: null,
    },
    toggles: {
      affected: false,
      contours: false,
      rupture: false,
    },
    data: {
      affected: null,
      contours: null,
      rupture: null,
    },
    loading: {
      affected: null,
      contours: null,
      rupture: null,
    },
    selectedFeature: null,
  }
}

function startPolling() {
  window.clearInterval(refreshTimer)
  refreshTimer = window.setInterval(refreshFeed, REFRESH_INTERVAL_MS)
}

function populateFeedOptions() {
  const options = Object.entries(FEEDS)
    .map(([value, feed]) => `<option value="${escapeAttribute(value)}">${escapeHtml(feed.label)}</option>`)
    .join('')

  feedSelect.innerHTML = options
}

function makeFeed(label, slug) {
  return {
    label,
    url: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${slug}.geojson`,
  }
}

function emptyFeatureCollection() {
  return {
    type: 'FeatureCollection',
    features: [],
  }
}

function makeRow(label, value, helpKey = label) {
  return { label, value, helpKey }
}

function makeGlossaryEntry(description, fieldKey, source) {
  return { description, fieldKey, source }
}

function magnitudeColor() {
  return [
    'interpolate',
    ['linear'],
    ['coalesce', ['get', 'mag'], 0],
    0, '#4f86f7',
    2, '#32b8c6',
    4, '#f0b43c',
    6, '#d84b3c',
  ]
}

function magnitudeRadius(stops) {
  return [
    'interpolate',
    ['linear'],
    ['coalesce', ['get', 'mag'], 0],
    0, stops[0],
    2, stops[1],
    4, stops[2],
    6, stops[3],
  ]
}

function resolveShakeMapValue(properties) {
  const candidateKeys = ['value', 'valuec', 'VAL', 'MMI', 'PARAMVALUE', 'GRID_CODE', 'weight']

  for (const key of candidateKeys) {
    const value = normalizeNumber(properties[key])
    if (value !== null) {
      return value
    }
  }

  const firstNumeric = Object.values(properties).map(normalizeNumber).find((value) => value !== null)
  return firstNumeric ?? 0
}

function describeShakeMapFeature(kind, properties, displayValue) {
  if (kind === 'affected') {
    return `Estimated shaking area around MMI ${displayValue.toFixed(1)}`
  }

  if (kind === 'contours') {
    return `MMI contour ${displayValue.toFixed(1)}`
  }

  return properties['rupture type'] ?? 'Rupture geometry'
}

function normalizeNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value)
  }

  return null
}

function colorForShakeMapValue(value) {
  if (value >= 8) return '#7c0f33'
  if (value >= 7) return '#a11d34'
  if (value >= 6) return '#d84b3c'
  if (value >= 5) return '#ef8a3a'
  if (value >= 4) return '#f0b43c'
  if (value >= 3) return '#f3d46b'
  if (value >= 2) return '#c7e98a'
  return '#dfe6ff'
}

function formatTime(value) {
  if (!value) {
    return 'Unknown time'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatMagnitude(value) {
  if (typeof value !== 'number') {
    return 'N/A'
  }

  return value.toFixed(1)
}

function formatDepth(value) {
  if (typeof value !== 'number') {
    return 'Unknown depth'
  }

  return `${value.toFixed(1)} km`
}

function formatCoordinate(value) {
  if (typeof value !== 'number') {
    return 'Unknown coordinate'
  }

  return value.toFixed(4)
}

function formatMaybeNumber(value) {
  if (typeof value !== 'number') {
    return value || 'N/A'
  }

  return String(value)
}

function formatTsunami(value) {
  if (value === 1) {
    return 'Yes'
  }

  if (value === 0) {
    return 'No'
  }

  return 'Unknown'
}

function formatBbox(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return 'N/A'
  }

  return value.join(', ')
}

function stringifyValue(value) {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return JSON.stringify(value)
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeAttribute(value) {
  return escapeHtml(value)
}
