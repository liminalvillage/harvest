<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import mapboxgl from 'mapbox-gl';
	import 'mapbox-gl/dist/mapbox-gl.css';
	import * as h3 from 'h3-js';
	import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
	import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
	import { ID } from '../dashboard/store';
	import { goto } from '$app/navigation';

	let mapContainer: HTMLElement;
	let map: mapboxgl.Map;
	let hexId: string;

	function getResolution(zoom: number): number {
		const zoomToRes = [
			[3.0, 0], [4.4, 1], [5.7, 2], [7.1, 3], [8.4, 4],
			[9.8, 5], [11.4, 6], [12.7, 7], [14.1, 8], [15.5, 9],
			[16.8, 10], [18.2, 11], [19.5, 12], [21.1, 13], [21.9, 14]
		];

		for (let [z, res] of zoomToRes) {
			if (zoom <= z) return res;
		}
		return 15;
	}

	function getZoomFromResolution(resolution: number): number {
		const resToZoom = [
			[0, 3.0], [1, 4.4], [2, 5.7], [3, 7.1], [4, 8.4],
			[5, 9.8], [6, 11.4], [7, 12.7], [8, 14.1], [9, 15.5],
			[10, 16.8], [11, 18.2], [12, 19.5], [13, 21.1], [14, 21.9], [15, 22.0]
		];

		for (let [res, zoom] of resToZoom) {
			if (resolution === res) return zoom;
		}
		return 22.0; // Default to maximum zoom if resolution is higher than expected
	}

	function renderHexes(map: mapboxgl.Map, lense: string) {
		const bounds = map.getBounds();
		let west = bounds.getWest();
		let east = bounds.getEast();
		const south = bounds.getSouth();
		const north = bounds.getNorth();

		const currentZoom = map.getZoom();
		const h3res = getResolution(currentZoom);
		const h3resLower = Math.max(0, h3res + 1);  // Lower resolution for the second layer

		console.log(`Rendering hexes: Zoom ${currentZoom}, Resolutions ${h3res} and ${h3resLower}`);

		function generateHexagons(resolution: number) {
			let hexagons = new Set<string>();
			for (let lat = south; lat <= north; lat += (north - south) / 20) {
				for (let lng = west; lng <= east; lng += (east - west) / 20) {
					hexagons.add(h3.latLngToCell(lat, lng, resolution));
				}
			}
			return hexagons;
		}

		function hexagonsToFeatures(hexagons: Set<string>) {
			return Array.from(hexagons).map(hexagon => {
				const boundary = h3.cellToBoundary(hexagon, true);
				return {
					type: 'Feature' as const,
					properties: { id: hexagon },
					geometry: {
						type: 'Polygon' as const,
						coordinates: [boundary]
					}
				};
			});
		}

		const hexagons = generateHexagons(h3res);
		const hexagonsLower = generateHexagons(h3resLower);

		console.log(`Generated ${hexagons.size} hexagons for resolution ${h3res}`);
		console.log(`Generated ${hexagonsLower.size} hexagons for resolution ${h3resLower}`);

		const features = hexagonsToFeatures(hexagons);
		const featuresLower = hexagonsToFeatures(hexagonsLower);

		map.getSource('hexagon-grid')?.setData({
			type: 'FeatureCollection',
			features: features
		});

		map.getSource('hexagon-grid-lower')?.setData({
			type: 'FeatureCollection',
			features: featuresLower
		});
	}

	function goToHex(hex: string) {
		const [lat, lng] = h3.cellToLatLng(hex);
		const resolution = h3.getResolution(hex);
		const zoom = getZoomFromResolution(resolution);
		
		map.flyTo({
			center: [lng, lat],
			zoom: zoom
		});
	}

	function updateSelectedHexagon(hexId: string) {
		const hexBoundary = h3.cellToBoundary(hexId, true);
		console.log('Hexagon boundary:', hexBoundary);
		map.getSource('selected-hexagon')?.setData({
			type: 'Feature',
			properties: {},
			geometry: {
				type: 'Polygon',
				coordinates: [hexBoundary]
			}
		});
		ID.set(hexId);
		goToHex(hexId);
	}

	onMount(() => {
		if (browser) {
			mapboxgl.accessToken = 'pk.eyJ1IjoicnZhbGVudGkiLCJhIjoiY2tncnMxeG81MDNjaTJybWpxOWhrOWpmZiJ9.v2W_bicM22r4YX4pCyRvHQ';
			map = new mapboxgl.Map({
				container: mapContainer,
				style: 'mapbox://styles/mapbox/satellite-streets-v12',
				center: [-71.224518, 42.213995],
				zoom: 9,
				projection: 'globe'
			});

			// Add geocoder (search box)
			const geocoder = new MapboxGeocoder({
				accessToken: mapboxgl.accessToken,
				mapboxgl: mapboxgl,
				marker: false,
				placeholder: 'Search for a location'
			});

			// Add geolocate control
			const geolocate = new mapboxgl.GeolocateControl({
				positionOptions: {
					enableHighAccuracy: true
				},
				trackUserLocation: true,
				showUserHeading: true
			});

			map.addControl(geocoder, 'top-right');
			map.addControl(geolocate, 'top-right');

			map.on('style.load', () => {
				map.setFog({
					color: "rgb(186, 210, 235)",
					"high-color": "rgb(36, 92, 223)",
					"horizon-blend": 0.02,
						"space-color": "rgb(11, 11, 25)",
					"star-intensity": 0.6
				});
			});

			map.on('load', () => {
				console.log('Map loaded');
				map.addSource('hexagon-grid', {
					type: 'geojson',
					data: { type: 'FeatureCollection', features: [] }
				});

				map.addLayer({
					id: 'hexagon-grid-layer',
					type: 'line',
					source: 'hexagon-grid',
					layout: {},
					paint: {
						'line-color': '#fff',
						'line-width': 3
					}
				});

				map.addSource('hexagon-grid-lower', {
					type: 'geojson',
					data: { type: 'FeatureCollection', features: [] }
				});

				map.addLayer({
					id: 'hexagon-grid-lower-layer',
					type: 'line',
					source: 'hexagon-grid-lower',
					layout: {},
					paint: {
						'line-color': '#aaa',
						'line-width': 1
					}
				});

				map.addSource('selected-hexagon', {
					type: 'geojson',
					data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[]] } }
				});

				map.addLayer({
					id: 'selected-hexagon-layer',
					type: 'fill',
					source: 'selected-hexagon',
					layout: {},
					paint: {
						'fill-color': '#088',
						'fill-opacity': 0.4,
						'fill-outline-color': '#000'
					}
				});

				renderHexes(map, 'default');

				// If there's an initial ID, go to that hexagon
				if ($ID) {
					goToHex($ID);
					updateSelectedHexagon($ID);
				}

			});

			map.on('move', () => renderHexes(map, 'default'));
			map.on('zoomend', () => renderHexes(map, 'default'));

			map.on('click', (e: mapboxgl.MapMouseEvent) => {
				console.log('Map clicked', e.lngLat);
				const { lng, lat } = e.lngLat;
				const zoom = map.getZoom();
				const resolution = getResolution(zoom);
				hexId = h3.latLngToCell(lat, lng, resolution);
				console.log('Hexagon ID:', hexId);
				updateSelectedHexagon(hexId);
			});
		}
	});

	// Subscribe to changes in the ID store
	$: if (map && $ID && $ID !== hexId) {
		hexId = $ID;
		updateSelectedHexagon($ID);
	}
</script>

<div class="map-container">
	<div bind:this={mapContainer} class="map"></div>
	{#if hexId}
		<div class="hex-info">Selected Hexagon: {hexId}</div>
	{/if}
</div>

<style>
	.map-container {
		position: relative;
		width: 100%;
		height: 100%; /* Changed from 400px to 100% */
		flex-grow: 1; /* Added to allow the container to grow and fill available space */
		display: flex; /* Added to ensure the map fills the container */
		flex-direction: column; /* Added to stack children vertically */
	}

	.map {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 100%;
		flex-grow: 1; /* Added to ensure the map fills the container */
	}

	.hex-info {
		position: absolute;
		bottom: 10px;
		left: 10px;
		background-color: rgba(255, 255, 255, 0.8);
		padding: 5px 10px;
		border-radius: 4px;
		font-size: 14px;
		z-index: 1; /* Added to ensure the info appears above the map */
	}

	:global(.mapboxgl-ctrl-top-right) {
		top: 10px !important;
		right: 10px !important;
	}

	:global(.mapboxgl-ctrl-geocoder) {
		min-width: 250px;
	}
</style>
