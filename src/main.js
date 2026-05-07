import './style.css'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const FEEDS = {
  all_hour: {
    label: 'All earthquakes, past hour',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
  },
  all_day: {
    label: 'All earthquakes, past day',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
  },
  significant_week: {
    label: 'Significant earthquakes, past week',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson',
  },
}

const REFRESH_INTERVAL_MS = 60_000
const EARTHQUAKE_SOURCE_ID = 'earthquakes'

const feedSelect = document.querySelector('#feed-select')
const statusText = document.querySelector('#status-text')
const updatedAt = document.querySelector('#updated-at')
const quakeCount = document.querySelector('#quake-count')

let refreshTimer
let activeFeed = feedSelect.value

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [15, 20],
  zoom: 1.5,
  attributionControl: true,
})

map.addControl(new maplibregl.NavigationControl(), 'top-right')

map.on('load', async () => {
  map.addSource(EARTHQUAKE_SOURCE_ID, {
    type: 'geojson',
    data: emptyFeatureCollection(),
    generateId: true,
  })

  map.addLayer({
    id: 'earthquake-circles',
    type: 'circle',
    source: EARTHQUAKE_SOURCE_ID,
    paint: {
      'circle-color': [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'mag'], 0],
        0, '#4f86f7',
        2, '#32b8c6',
        4, '#f0b43c',
        6, '#d84b3c',
      ],
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'mag'], 0],
        0, 4,
        2, 8,
        4, 14,
        6, 20,
      ],
      'circle-opacity': 0.82,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff',
    },
  })

  map.addLayer({
    id: 'earthquake-glow',
    type: 'circle',
    source: EARTHQUAKE_SOURCE_ID,
    paint: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'mag'], 0],
        0, 8,
        2, 14,
        4, 24,
        6, 36,
      ],
      'circle-color': '#f04d3a',
      'circle-opacity': 0.08,
    },
  }, 'earthquake-circles')

  map.on('click', 'earthquake-circles', (event) => {
    const feature = event.features?.[0]
    if (!feature) {
      return
    }

    const coordinates = feature.geometry.coordinates.slice(0, 2)
    const magnitude = formatMagnitude(feature.properties.mag)
    const depth = formatDepth(feature.geometry.coordinates[2])
    const place = feature.properties.place ?? 'Unknown location'
    const time = formatTime(feature.properties.time)
    const detailUrl = feature.properties.url

    new maplibregl.Popup({ closeButton: false, offset: 18 })
      .setLngLat(coordinates)
      .setHTML(`
        <article class="popup">
          <p class="popup-kicker">Magnitude ${magnitude}</p>
          <h2>${escapeHtml(place)}</h2>
          <p>${escapeHtml(time)}</p>
          <p>Depth ${escapeHtml(depth)}</p>
          <p><a href="${detailUrl}" target="_blank" rel="noreferrer">View event on USGS</a></p>
        </article>
      `)
      .addTo(map)
  })

  map.on('mouseenter', 'earthquake-circles', () => {
    map.getCanvas().style.cursor = 'pointer'
  })

  map.on('mouseleave', 'earthquake-circles', () => {
    map.getCanvas().style.cursor = ''
  })

  await refreshFeed()
  startPolling()
})

feedSelect.addEventListener('change', async (event) => {
  activeFeed = event.target.value
  statusText.textContent = `Switching to ${FEEDS[activeFeed].label.toLowerCase()}...`
  await refreshFeed()
  startPolling()
})

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
    source.setData(data)
    quakeCount.textContent = String(data.features.length)
    updatedAt.textContent = formatTime(Date.now())
    statusText.textContent = `Showing ${FEEDS[activeFeed].label.toLowerCase()}.`
  } catch (error) {
    console.error(error)
    statusText.textContent = 'Unable to refresh earthquake data right now.'
  }
}

function startPolling() {
  window.clearInterval(refreshTimer)
  refreshTimer = window.setInterval(refreshFeed, REFRESH_INTERVAL_MS)
}

function emptyFeatureCollection() {
  return {
    type: 'FeatureCollection',
    features: [],
  }
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

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
