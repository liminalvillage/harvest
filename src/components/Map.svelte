<script lang="ts">
	// @ts-nocheck -- Disabling TypeScript checking for this file due to Svelte 5 JSX compatibility issues
	import { onMount, onDestroy, getContext, createEventDispatcher} from "svelte";
	// @ts-ignore - Fix for app/environment module error
	import { browser } from "$app/environment";
	import mapboxgl from "mapbox-gl";
	import "mapbox-gl/dist/mapbox-gl.css";
	// @ts-ignore - Fix for h3-js module error
	import * as h3 from "h3-js";
	import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
	import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";
	import { ID } from "../dashboard/store";
	import HoloSphere from 'holosphere';
	import MapSidebar from './MapSidebar.svelte';
	import type { LensType, LensOption } from '../types/Map';

	let holosphere = getContext('holosphere') as HoloSphere;

	let mapContainer: HTMLElement;
	let map: mapboxgl.Map;
	let hexId: string;
	export let selectedLens: LensType = 'quests';
	export let isVisible: boolean = true;
	let holoSubscriptions = new Map();
	let showSidebar = false;
	let sidebarPosition = { x: 0, y: 0 };
	let isDragging = false;
	let dragOffset = { x: 0, y: 0 };
	let lastSidebarPosition: { x: number, y: number } | null = null;
	let lensData: Record<LensType, Set<string>> = {
		quests: new Set<string>(),
		needs: new Set<string>(),
		offers: new Set<string>(),
		communities: new Set<string>(),
		organizations: new Set<string>(),
		projects: new Set<string>(),
		currencies: new Set<string>(),
		people: new Set<string>(),
		holons: new Set<string>()
	};

	const lensOptions: LensOption[] = [
		{ value: 'quests', label: 'Tasks' },
		{ value: 'needs', label: 'Local Needs' },
		{ value: 'offers', label: 'Offers' },
		{ value: 'communities', label: 'Communities' },
		{ value: 'organizations', label: 'Organizations' },
		{ value: 'projects', label: 'Projects' },
		{ value: 'currencies', label: 'Currencies' },
		{ value: 'people', label: 'People' },
		{ value: 'holons', label: 'Holons' }
	];

	const dispatch = createEventDispatcher();

	// Keep just the retry counter to prevent infinite loops
	let fetchRetryCount = 0;
	const MAX_FETCH_RETRIES = 2;

	// Keep track of movement state
	let moveTimeout: number;
	let isMoving = false;
	
	// Keep track of last fetch time to implement throttling
	let lastFetchTime = 0;
	const THROTTLE_INTERVAL = 2000; // 2 seconds minimum between fetches
	
	// Clear any existing timeout
	function clearMoveTimeout() {
		if (moveTimeout) {
			window.clearTimeout(moveTimeout);
			moveTimeout = 0;
		}
	}

	function getResolution(zoom: number): number {
		const zoomToRes = [
			[3.0, 0],
			[4.4, 1],
			[5.7, 2],
			[7.1, 3],
			[8.4, 4],
			[9.8, 5],
			[11.4, 6],
			[12.7, 7],
			[14.1, 8],
			[15.5, 9],
			[16.8, 10],
			[18.2, 11],
			[19.5, 12],
			[21.1, 13],
			[21.9, 14],
		];

		for (let [z, res] of zoomToRes) {
			if (zoom <= z) return res;
		}
		return 15;
	}

	function getZoomFromResolution(resolution: number): number {
		const resToZoom = [
			[0, 3.0],
			[1, 4.4],
			[2, 5.7],
			[3, 7.1],
			[4, 8.4],
			[5, 9.8],
			[6, 11.4],
			[7, 12.7],
			[8, 14.1],
			[9, 15.5],
			[10, 16.8],
			[11, 18.2],
			[12, 19.5],
			[13, 21.1],
			[14, 21.9],
			[15, 22.0],
		];

		for (let [res, zoom] of resToZoom) {
			if (resolution === res) return zoom;
		}
		return 22.0; // Default to maximum zoom if resolution is higher than expected
	}

	function renderHexes(map: mapboxgl.Map, lens: string) {
		const bounds = map.getBounds();
		if (!bounds) return;
		
		let west = bounds.getWest();
		let east = bounds.getEast();
		const south = bounds.getSouth();
		const north = bounds.getNorth();

		const currentZoom = map.getZoom();
		const currentResolution = getResolution(currentZoom);

		// Get highlighted hexes based on lens
		let highlightedHexes = new Set<string>();
		let highlightColor = '#088';

		switch (lens) {
			case 'quests':
				highlightedHexes = lensData.quests;
				highlightColor = '#f44336';
				break;
			case 'needs':
				highlightedHexes = lensData.needs;
				highlightColor = '#2196f3';
				break;
			case 'offers':
				highlightedHexes = lensData.offers;
				highlightColor = '#4caf50';
				break;
			case 'communities':
				highlightedHexes = lensData.communities;
				highlightColor = '#ff9800';
				break;
			case 'organizations':
				highlightedHexes = lensData.organizations;
				highlightColor = '#9c27b0';
				break;
			case 'projects':
				highlightedHexes = lensData.projects;
				highlightColor = '#3f51b5';
				break;
			case 'currencies':
				highlightedHexes = lensData.currencies;
				highlightColor = '#e91e63';
				break;
			case 'people':
				highlightedHexes = lensData.people;
				highlightColor = '#607d8b';
				break;
			case 'holons':
				highlightedHexes = lensData.holons;
				highlightColor = '#ff5722';
				break;
		}

		// Filter highlighted hexes based on resolution
		const visibleHighlightedHexes = new Set(
			Array.from(highlightedHexes).filter(hex => {
				const hexResolution = h3.getResolution(hex);
				return currentResolution <= hexResolution;
			})
		);

		// Update the highlighted hexagons if any are visible at current resolution
		if (visibleHighlightedHexes.size > 0) {
			map.getSource("highlighted-hexagons")?.setData(
				highlightHexagons(visibleHighlightedHexes, highlightColor)
			);
		}

		const h3res = getResolution(currentZoom);
		const h3resLower = Math.max(0, h3res + 1);

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
			return Array.from(hexagons)
				.flatMap((hexagon) => {
					const boundary = h3.cellToBoundary(hexagon, true);
					const [lat, lng] = h3.cellToLatLng(hexagon);
					const [vertexLat, vertexLng] = boundary[0];
					
					// Check if the hexagon crosses the antimeridian by looking for large jumps
					let needsNormalization = false;
					for (let i = 0; i < boundary.length; i++) {
						const j = (i + 1) % boundary.length;
						const lngDiff = Math.abs(boundary[i][1] - boundary[j][1]);
						if (lngDiff > 180) {
							needsNormalization = true;
							break;
						}
					}

					// If we need to normalize, shift coordinates that are on the wrong side
					let normalizedBoundary = boundary;
					if (needsNormalization) {
						const avgLng = boundary.reduce((sum: number, [_, lng]: [number, number]) => sum + lng, 0) / boundary.length;
						normalizedBoundary = boundary.map(([lat, lng]: [number, number]) => {
							if (avgLng < 0 && lng > 0) {
								return [lat, lng - 360];
							}
							if (avgLng > 0 && lng < 0) {
								return [lat, lng + 360];
							}
							return [lat, lng];
						});
					}

					return [
						{
							type: "Feature" as const,
							properties: { 
								id: hexagon
							},
							geometry: {
								type: "Polygon" as const,
								coordinates: [normalizedBoundary]
							}
						},
						{
							type: "Feature" as const,
							properties: { 
								id: hexagon,
								center_lat: lat,
								center_lng: lng,
								vertex_lat: vertexLat,
								vertex_lng: vertexLng
							},
							geometry: {
								type: "Point" as const,
								coordinates: [lng, lat]
							}
						}
					];
				});
		}

		function hexagonsToCenterFeatures(hexagons: Set<string>) {
			return Array.from(hexagons)
				.map((hexagon) => {
					const [lat, lng] = h3.cellToLatLng(hexagon);
					const boundary = h3.cellToBoundary(hexagon, true);
					// Take the first vertex for radius calculation
					const [vertexLat, vertexLng] = boundary[0];
					
					return {
						type: "Feature" as const,
						properties: { 
							id: hexagon,
							center_lat: lat,
							center_lng: lng,
							vertex_lat: vertexLat,
							vertex_lng: vertexLng
						},
						geometry: {
							type: "Point" as const,
							coordinates: [lng, lat]
						}
					};
				});
		}

		function highlightHexagons(hexagons: Set<string>, color: string) {
			const features = Array.from(hexagons).flatMap((hexagon) => {
				const boundary = h3.cellToBoundary(hexagon, true);
				const [lat, lng] = h3.cellToLatLng(hexagon);
				const hexSize = h3.getHexagonEdgeLengthAvg(h3.getResolution(hexagon), 'km') * 1000;
				
				// Check for antimeridian crossing
				let needsNormalization = false;
				for (let i = 0; i < boundary.length; i++) {
					const j = (i + 1) % boundary.length;
					const lngDiff = Math.abs(boundary[i][1] - boundary[j][1]);
					if (lngDiff > 180) {
						needsNormalization = true;
						break;
					}
				}

				// Normalize if needed
				let normalizedBoundary = boundary;
				if (needsNormalization) {
					const avgLng = boundary.reduce((sum: number, [_, lng]: [number, number]) => sum + lng, 0) / boundary.length;
					normalizedBoundary = boundary.map(([lat, lng]: [number, number]) => {
						if (avgLng < 0 && lng > 0) {
							return [lat, lng - 360];
						}
						if (avgLng > 0 && lng < 0) {
							return [lat, lng + 360];
						}
						return [lat, lng];
					});
				}

				// Return both polygon and point features
				return [
					{
						type: "Feature" as const,
						properties: { 
							id: hexagon,
							color: color
						},
						geometry: {
							type: "Polygon" as const,
							coordinates: [normalizedBoundary],
						}
					},
					{
						type: "Feature" as const,
						properties: { 
							id: hexagon,
							color: color,
							radius: hexSize
						},
						geometry: {
							type: "Point" as const,
							coordinates: [lng, lat]
						}
					}
				];
			});

			return {
				type: "FeatureCollection" as const,
				features: features
			};
		}

		const hexagons = generateHexagons(h3res);
		const hexagonsLower = generateHexagons(h3resLower);

		map.getSource("hexagon-grid")?.setData({
			type: "FeatureCollection",
			features: hexagonsToFeatures(hexagons)
		});

		map.getSource("hexagon-grid-lower")?.setData({
			type: "FeatureCollection",
			features: hexagonsToFeatures(hexagonsLower)
		});
	}

	function goToHex(hex: string) {
		if (!isH3Cell(hex)) return;
		
		const [lat, lng] = h3.cellToLatLng(hex);
		const resolution = h3.getResolution(hex);
		const zoom = getZoomFromResolution(resolution);
		
		// First zoom to the location
		map.flyTo({
			center: [lng, lat],
			zoom: zoom,
		});

		// After zooming, update the selected hexagon visualization
		map.once('moveend', () => {
			map.getSource("selected-hexagon")?.setData({
				type: "Feature",
				properties: {},
				geometry: {
					type: "Polygon",
					coordinates: [h3.cellToBoundary(hex, true)],
				},
			});
		});
	}

	function updateSelectedHexagon(hexId: string) {
		const boundary = h3.cellToBoundary(hexId, true);
		const [lat, lng] = h3.cellToLatLng(hexId);
		const hexSize = h3.getHexagonEdgeLengthAvg(h3.getResolution(hexId), 'km') * 1000;
		
		// Create both polygon and point features for the selected hexagon
		const features = {
			type: "FeatureCollection" as const,
			features: [
				{
					type: "Feature",
					properties: {},
					geometry: {
						type: "Polygon",
						coordinates: [boundary]
					}
				},
				{
					type: "Feature",
					properties: {
						radius: hexSize
					},
					geometry: {
						type: "Point",
						coordinates: [lng, lat]
					}
				}
			]
		};
		
		map.getSource("selected-hexagon")?.setData(features);
		
		dispatch('holonChange', { id: hexId });
		
		ID.set(hexId);
		goToHex(hexId);

		// Show sidebar when hexagon is selected
		showSidebar = true;
		
		// If we have a saved position, use it, otherwise calculate a new position
		if (lastSidebarPosition) {
			sidebarPosition = lastSidebarPosition;
		}
		// else position will be calculated in the click handler
	}

	// Function to ensure loading state is properly cleared
	function ensureLoadingReset() {
		// No need to implement this function as the isLoading variable is no longer used
	}

	// Replace subscription model with simple data fetching
	function fetchLensData(lens: string) {
		// Implement throttling
		const now = Date.now();
		if (now - lastFetchTime < THROTTLE_INTERVAL) {
			console.log(`[Map] Throttling fetch for ${lens}, too soon after last fetch`);
			return;
		}
		
		// Update last fetch time
		lastFetchTime = now;

		// Cancel any pending fetch operations
		clearMoveTimeout();

		// Get the current map bounds
		const bounds = map.getBounds();
		if (!bounds) {
			return;
		}
		
		// Capture the current lens in a closure to ensure we're still working with the same lens
		// even if it changes during the async operations
		const currentLens = lens;
		
		const west = bounds.getWest();
		const east = bounds.getEast();
		const south = bounds.getSouth();
		const north = bounds.getNorth();
		
		// Get current zoom and resolution
		const currentZoom = map.getZoom();
		const h3res = getResolution(currentZoom);
		
		// Generate hexagons for the visible area - limit the number for better performance
		const hexagons = new Set<string>();
		const latStep = (north - south) / 8; // Further reduced sample points
		const lngStep = (east - west) / 8;
		
		for (let lat = south; lat <= north; lat += latStep) {
			for (let lng = west; lng <= east; lng += lngStep) {
				hexagons.add(h3.latLngToCell(lat, lng, h3res));
			}
		}

		console.log(`[Map] Fetching ${currentLens} data for ${hexagons.size} hexagons`);
		
		// Create a map to track which hexagons have content
		const hexagonsWithContent = new Set<string>();
		
		// Make non-blocking fetch calls for each hexagon
		let fetchesInProgress = 0;
		let fetchesCompleted = 0;
		
		// When all fetches are done, hide the loading indicator
		const checkAllFetchesComplete = () => {
			fetchesCompleted++;
			if (fetchesCompleted === fetchesInProgress) {
				// Make sure we're still working with the current lens
				if (currentLens === selectedLens) {
					// Update lens data with hexagons that have content
					lensData[currentLens as LensType] = hexagonsWithContent;
					
					// Render the updated hexes
					renderHexes(map, currentLens);
					
					console.log(`[Map] Found ${hexagonsWithContent.size} hexagons with ${currentLens} data (${fetchesCompleted}/${fetchesInProgress} fetches)`);
				} else {
					console.log(`[Map] Lens changed during fetch, discarding results for ${currentLens}`);
				}
			}
		};
		
		// Process each hexagon
		let hasStartedFetches = false;
		for (const hex of hexagons) {
			fetchesInProgress++;
			hasStartedFetches = true;
			
			// Non-blocking call without await
			console.log(`[Map Debug] Fetching data for hexagon: ${hex}, lens: ${lens}`);
			holosphere.getAll(hex, lens)
				.then(items => {
					// Add to set if content exists
					console.log(`[Map Debug] Retrieved ${items?.length || 0} items for hexagon: ${hex}, lens: ${lens}`);
					if (items && items.length > 0) {
						console.log(`[Map Debug] Adding hexagon with content: ${hex}`);
						// Always add the hexagon to show highlights - temporary fix
						hexagonsWithContent.add(hex);
					}
					checkAllFetchesComplete();
				})
				.catch(error => {
					console.error(`[Map] Error fetching ${lens} data for ${hex}:`, error);
					checkAllFetchesComplete();
				});
		}
		
		// If no fetches started, just update the UI
		if (!hasStartedFetches) {
			renderHexes(map, lens);
		}
	}

	let lastResolution: number;

	function clearHexagons() {
		// Clear selected hexagon
		map.getSource("selected-hexagon")?.setData({
			type: "Feature",
			properties: {},
			geometry: {
				type: "Point",
				coordinates: [0, 0]
			}
		});

		// Clear highlighted hexagons
		map.getSource("highlighted-hexagons")?.setData({
			type: "FeatureCollection",
			features: []
		});
	}

	function handleMapMove() {
		// Just update visuals during movement, no data fetching
		const currentZoom = map.getZoom();
		const currentResolution = getResolution(currentZoom);

		// Check if we've crossed a resolution boundary
		if (lastResolution !== undefined && lastResolution !== currentResolution) {
			clearHexagons();
			
			// If we have a selected hexagon, check if we should reapply it
			if (hexId) {
				const hexResolution = h3.getResolution(hexId);
				if (currentResolution <= hexResolution) {
					const boundary = h3.cellToBoundary(hexId, true);
					map.getSource("selected-hexagon")?.setData({
						type: "Feature",
						properties: {},
						geometry: {
							type: "Polygon",
							coordinates: [boundary],
						},
					});
				}
			}
		}
		lastResolution = currentResolution;

		// Always render hexes immediately for visual feedback
		if (selectedLens) renderHexes(map, selectedLens);
		
		// Mark that we're in a moving state
		isMoving = true;
	}

	let mapInitialized = false;

	function initializeMap() {
		if (mapInitialized || !browser) return;
		
		mapboxgl.accessToken = "pk.eyJ1IjoicnZhbGVudGkiLCJhIjoiY2tncnMxeG81MDNjaTJybWpxOWhrOWpmZiJ9.v2W_bicM22r4YX4pCyRvHQ";
		map = new mapboxgl.Map({
			container: mapContainer,
			style: "mapbox://styles/mapbox/satellite-streets-v12",
			center: [13.7364963,42.8917537],
			zoom: 5,
			projection: "globe",
			renderWorldCopies: false,
		});

		// Add geocoder (search box)
		const geocoder = new MapboxGeocoder({
			accessToken: mapboxgl.accessToken,
			mapboxgl: mapboxgl,
			marker: false,
			placeholder: "Search for a location",
		});

		// Add geolocate control
		const geolocate = new mapboxgl.GeolocateControl({
			positionOptions: {
				enableHighAccuracy: true,
			},
			trackUserLocation: true,
			showUserHeading: true,
		});

		map.addControl(geocoder, "top-right");
		map.addControl(geolocate, "top-right");

		map.on("style.load", () => {
			map.setFog({
				color: "rgb(186, 210, 235)",
				"high-color": "rgb(36, 92, 223)",
				"horizon-blend": 0.02,
				"space-color": "rgb(11, 11, 25)",
				"star-intensity": 0.6,
			});
		});

		map.on("load", () => {
			console.log("Map loaded");
			
			// Check if sources already exist and remove them
			try {
				if (map.getSource("hexagon-grid")) {
					console.log('[Map] Removing existing hexagon-grid source');
					// Need to remove layers first
					if (map.getLayer("hexagon-grid-outline-layer")) map.removeLayer("hexagon-grid-outline-layer");
					if (map.getLayer("hexagon-grid-circle-layer")) map.removeLayer("hexagon-grid-circle-layer");
					map.removeSource("hexagon-grid");
				}
				
				// Base hexagon grid layers
				map.addSource("hexagon-grid", {
					type: "geojson",
					data: { type: "FeatureCollection", features: [] }
				});

				map.addLayer({
					id: "hexagon-grid-outline-layer",
					type: "line",
					source: "hexagon-grid",
					paint: {
						"line-color": "#fff",
						"line-width": 1,
						"line-opacity": 0.6
					}
				});

				// Base hexagon grid circle layer
				map.addLayer({
					id: "hexagon-grid-circle-layer",
					type: "circle",
					source: "hexagon-grid",
					paint: {
						"circle-color": "#fff",
						"circle-opacity": 0.6,
						"circle-stroke-width": 1,
						"circle-stroke-color": "#fff",
						"circle-stroke-opacity": 0.6,
						"circle-radius": [
							"interpolate",
							["exponential", 2],
							["zoom"],
							0, 2,
							22, 100
						]
					}
				});

				// Lower resolution grid layers
				map.addSource("hexagon-grid-lower", {
					type: "geojson",
					data: { type: "FeatureCollection", features: [] }
				});

				map.addLayer({
					id: "hexagon-grid-lower-outline-layer",
					type: "line",
					source: "hexagon-grid-lower",
					paint: {
						"line-color": "#aaa",
						"line-width": 0.5,
						"line-opacity": 0.4
					}
				});

				// Lower resolution grid circle layer
				map.addLayer({
					id: "hexagon-grid-lower-circle-layer",
					type: "circle",
					source: "hexagon-grid-lower",
					paint: {
						"circle-color": "#aaa",
						"circle-opacity": 0.4,
						"circle-stroke-width": 0.5,
						"circle-stroke-color": "#aaa",
						"circle-stroke-opacity": 0.4,
						"circle-radius": [
							"interpolate",
							["exponential", 2],
							["zoom"],
							0, 1,
							22, 50
						]
					}
				});

				// Highlighted hexagons layers
				map.addSource("highlighted-hexagons", {
					type: "geojson",
					data: {
						type: "FeatureCollection",
						features: []
					}
				});

				// Add highlighted hexagon fill FIRST
				map.addLayer({
					id: "highlighted-hexagons-fill-layer",
					type: "fill",
					source: "highlighted-hexagons",
					paint: {
						"fill-color": ["get", "color"],
						"fill-opacity": 0.6
					}
				});

				// Then add the outline
				map.addLayer({
					id: "highlighted-hexagons-outline-layer",
					type: "line",
					source: "highlighted-hexagons",
					paint: {
						"line-color": ["get", "color"],
						"line-width": 2,
						"line-opacity": 0.8
					}
				});

				// Highlighted hexagons circle layer
				map.addLayer({
					id: "highlighted-hexagons-circle-layer",
					type: "circle",
					source: "highlighted-hexagons",
					paint: {
						"circle-color": ["get", "color"],
						"circle-opacity": 0.6,
						"circle-stroke-width": 2,
						"circle-stroke-color": ["get", "color"],
						"circle-stroke-opacity": 0.8,
						"circle-radius": [
							"interpolate",
							["exponential", 2],
							["zoom"],
							0, 2,
							22, 100
						]
					}
				});

				// Selected hexagon layers
				map.addSource("selected-hexagon", {
					type: "geojson",
					data: {
						type: "Feature",
						properties: {},
						geometry: { type: "Polygon", coordinates: [[]] }
					}
				});

				// Add selected hexagon fill FIRST
				map.addLayer({
					id: "selected-hexagon-fill-layer",
					type: "fill",
					source: "selected-hexagon",
					paint: {
						"fill-color": "#088",
						"fill-opacity": 0.6
					}
				});

				// Then add the outline
				map.addLayer({
					id: "selected-hexagon-outline-layer",
					type: "line",
					source: "selected-hexagon",
					paint: {
						"line-color": "#088",
						"line-width": 2,
						"line-opacity": 0.8
					}
				});

				// Selected hexagon circle layer
				map.addLayer({
					id: "selected-hexagon-circle-layer",
					type: "circle",
					source: "selected-hexagon",
					paint: {
						"circle-color": "#088",
						"circle-opacity": 0.6,
						"circle-stroke-width": 2,
						"circle-stroke-color": "#088",
						"circle-stroke-opacity": 0.8,
						"circle-radius": [
							"interpolate",
							["exponential", 2],
							["zoom"],
							0, 2,
							22, 100
						]
					}
				});
			} catch (e) {
				console.error('[Map] Error cleaning up existing sources/layers:', e);
			}
			
			// Initial data fetch after map is fully loaded
			console.log('[Map] Map initialized, scheduling initial data fetch');
			clearMoveTimeout();
			moveTimeout = window.setTimeout(() => {
				if (selectedLens) {
					console.log('[Map] Performing initial data fetch');
					fetchLensData(selectedLens);
				}
			}, 500);
			renderHexes(map, selectedLens);
			mapInitialized = true;
		});

		// Update the movement handlers
		map.on("movestart", () => {
			// Just mark that we're starting to move
			isMoving = true;
			// Cancel any pending fetch operations
			clearMoveTimeout();
		});

		map.on("move", handleMapMove);
		map.on("zoom", handleMapMove);
		
		map.on("moveend", () => {
			// Movement has ended
			isMoving = false;
			console.log('[Map] Movement ended');
			
			// Clear any previous timeout
			clearMoveTimeout();
			
			// Schedule data fetch after movement with a delay
			moveTimeout = window.setTimeout(() => {
				if (selectedLens) {
					console.log('[Map] Fetching data after movement pause');
					fetchLensData(selectedLens);
				}
			}, 1000); // 1 second delay
			
			// Always render hexes with existing data for immediate feedback
			renderHexes(map, selectedLens);
		});

		map.on("click", (e: mapboxgl.MapMouseEvent) => {
			console.log("Map clicked", e.lngLat);
			const { lng, lat } = e.lngLat;
			const zoom = map.getZoom();
			const resolution = getResolution(zoom);
			const newHexId = h3.latLngToCell(lat, lng, resolution);
			console.log("Hexagon ID:", newHexId);
			
			// Only calculate a new position if we don't have a saved one
			if (!lastSidebarPosition) {
				// Calculate sidebar position based on click point
				const point = e.point;
				const mapRect = mapContainer.getBoundingClientRect();
				
				// Calculate the initial width for the sidebar
				const sidebarWidth = Math.min(400, mapRect.width * 0.4); // 40% of map width up to 400px max
				const sidebarHeight = Math.min(500, mapRect.height * 0.7); // 70% of map height up to 500px max
				
				// Calculate position relative to the map (not the page)
				let posX, posY;
				
				// Position the sidebar to avoid going off-screen
				// Place it to the right of the click  if there's room, otherwise to the left
				if (point.x + sidebarWidth + 20 < mapRect.width) {
					// Enough room to the right
					posX = point.x + 20; // 20px offset from click point
				} else {
					// Place to the left
					posX = Math.max(point.x - sidebarWidth - 20, 10); // 20px offset left, minimum 10px from left edge
				}
				
				// Position vertically - try to center it on the click point
				posY = Math.max(10, Math.min(mapRect.height - sidebarHeight - 10, point.y - (sidebarHeight / 2)));
				
				// Update the sidebar position
				sidebarPosition = { x: posX, y: posY };
				// Store this as the last position
				lastSidebarPosition = { ...sidebarPosition };
			}
			
			// Only update if it's a valid H3 cell
			if (isH3Cell(newHexId)) {
				hexId = newHexId;
				updateSelectedHexagon(newHexId);
			}

			// Log lens data for the clicked hexagon - non-blocking call
			holosphere.getAll(newHexId, selectedLens)
				.then(data => {
					console.log(`${selectedLens} data for hexagon ${newHexId}:`, data);
				})
				.catch(error => {
					console.error(`Error fetching ${selectedLens} data:`, error);
				});
		});
	}

	// Function to make sure the sidebar position is within map bounds
	function adjustSidebarPosition() {
		// Only proceed if we have a position and the map is initialized
		if (lastSidebarPosition && map && mapContainer) {
			const mapRect = mapContainer.getBoundingClientRect();
			const sidebarElements = document.querySelectorAll('.sidebar-overlay');
			
			if (sidebarElements.length > 0) {
				const sidebarRect = sidebarElements[0].getBoundingClientRect();
				const sidebarWidth = sidebarRect.width;
				const sidebarHeight = sidebarRect.height;
				
				// Check if current position would place the sidebar outside map boundaries
				const currentX = lastSidebarPosition.x;
				const currentY = lastSidebarPosition.y;
				
				// Adjust if needed to keep within map boundaries
				const adjustedX = Math.max(0, Math.min(mapRect.width - sidebarWidth, currentX));
				const adjustedY = Math.max(0, Math.min(mapRect.height - sidebarHeight, currentY));
				
				// Update position if adjustments were needed
				if (adjustedX !== currentX || adjustedY !== currentY) {
					sidebarPosition = { x: adjustedX, y: adjustedY };
					lastSidebarPosition = { ...sidebarPosition };
				}
			}
		}
	}
	
	// Set up resize handler when component is mounted
	onMount(() => {
		if (browser) {
			// Add global mouse move and up listeners (only when in browser)
			window.addEventListener('mousemove', handleDrag);
			window.addEventListener('mouseup', handleDragEnd);
			
			// Add resize listener to ensure sidebar stays visible
			window.addEventListener('resize', adjustSidebarPosition);
			
			// Add a small delay to ensure container is properly sized
			setTimeout(initializeMap, 100);
		}
		
		return () => {
			// Clean up event listeners
			window.removeEventListener('mousemove', handleDrag);
			window.removeEventListener('mouseup', handleDragEnd);
			window.removeEventListener('resize', adjustSidebarPosition);
		};
	});

	// Add cleanup function for map
	function cleanupMap() {
		if (!map) return;
		
		try {
			console.log('[Map] Cleaning up map instance');
			
			// Remove event listeners first
			map.off('movestart');
			map.off('move', handleMapMove);
			map.off('zoom', handleMapMove);
			map.off('moveend');
			map.off('click');
			
			// Try to clean up layers and sources to prevent ID conflicts
			try {
				// Remove layers before removing sources
				const layersToRemove = [
					"hexagon-grid-outline-layer",
					"hexagon-grid-circle-layer",
					"hexagon-grid-lower-outline-layer",
					"hexagon-grid-lower-circle-layer",
					"highlighted-hexagons-fill-layer",
					"highlighted-hexagons-outline-layer",
					"highlighted-hexagons-circle-layer",
					"selected-hexagon-fill-layer",
					"selected-hexagon-outline-layer",
					"selected-hexagon-circle-layer"
				];
				
				for (const layer of layersToRemove) {
					if (map.getLayer(layer)) {
						console.log(`[Map] Removing layer: ${layer}`);
						map.removeLayer(layer);
					}
				}
				
				// Now remove sources
				const sourcesToRemove = [
					"hexagon-grid",
					"hexagon-grid-lower",
					"highlighted-hexagons",
					"selected-hexagon"
				];
				
				for (const source of sourcesToRemove) {
					if (map.getSource(source)) {
						console.log(`[Map] Removing source: ${source}`);
						map.removeSource(source);
					}
				}
			} catch (e) {
				console.warn('[Map] Error cleaning up layers/sources:', e);
			}
			
			// Finally remove the map
			map.remove();
			map = null;
			mapInitialized = false;
			console.log('[Map] Map cleanup complete');
		} catch (error) {
			console.error('[Map] Error cleaning up map:', error);
			// Force reset of variables
			map = null;
			mapInitialized = false;
		}
	}

	// Add function to detect holon type
	function isH3Cell(id: string): boolean {
		try {
			return h3.isValidCell(id);
		} catch {
			return false;
		}
	}

	// Update ID store subscription
	$: if ($ID && $ID !== hexId && isVisible) {
		hexId = $ID;
		dispatch('holonChange', { id: $ID });
		// Only update map if we're visible and it's a valid H3 cell
		if (map && isH3Cell($ID)) {
			updateSelectedHexagon($ID);
		}
	}

	// Update the lens selection to use fetch instead of subscribe
	$: if (map && selectedLens) {
		// Add a console log to track lens changes
		console.log(`[Map] Lens selection triggered: ${selectedLens}`);
		
		// Cancel any existing fetch timeout
		clearMoveTimeout();
		
		// Schedule a fetch after a short delay
		moveTimeout = window.setTimeout(() => {
			console.log(`[Map] Fetching data for lens: ${selectedLens}`);
			fetchLensData(selectedLens);
		}, 500);
		
		// Always render hexes with existing data for immediate feedback
		renderHexes(map, selectedLens);
	}

	// Watch for visibility changes
	$: if (isVisible) {
		// Initialize or re-initialize map when becoming visible
		if (!mapInitialized && browser) {
			console.log('[Map] Component is now visible, initializing map');
			// Add a small delay to ensure container is properly sized
			window.setTimeout(initializeMap, 100);
		}
	} else if (mapInitialized) {
		// Clean up map when becoming invisible
		console.log('[Map] Component is now hidden, cleaning up map');
		performFinalCleanup();
	}

	// Comprehensive cleanup function
	function performFinalCleanup() {
		console.log('[Map] Performing final cleanup...');
		
		// Make sure all timeouts are cleared
		if (moveTimeout) {
			clearTimeout(moveTimeout);
			moveTimeout = 0;
		}
		
	// Reset movement state
	isMoving = false;
	
	// Reset fetch retry counter
	fetchRetryCount = 0;
	
	// Create a fresh map to ensure no references remain
	holoSubscriptions = new Map();
	
	// Clear all lens data to free memory
	for (const key of Object.keys(lensData)) {
		lensData[key as LensType] = new Set<string>();
	}
	
	// Clean up map resources
	cleanupMap();
	
	console.log('[Map] Final cleanup complete');
	}

	// Update onDestroy to reset all state
	onDestroy(() => {
		console.log('[Map] Component being destroyed, cleaning up resources');
		performFinalCleanup();
	});

	// Also ensure cleanup on hide/unmount via the isVisible property
	$: if (!isVisible && mapInitialized) {
		console.log('[Map] Component hidden, cleaning up resources');
		performFinalCleanup();
	}

	// Function to close the sidebar
	function closeSidebar() {
		showSidebar = false;
		// Keep lastSidebarPosition so it's remembered for next time
	}

	// Drag handling functions
	function handleDragStart(event: MouseEvent) {
		isDragging = true;
		const sidebarElement = event.currentTarget as HTMLElement;
		const rect = sidebarElement.getBoundingClientRect();
		
		// Calculate the offset from the mouse position to the top-left corner of the sidebar
		dragOffset = {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top
		};
		
		// Prevent text selection during drag
		event.preventDefault();
	}
	
	function handleDrag(event: MouseEvent) {
		if (!isDragging) return;
		
		// Calculate new position based on mouse position and drag offset
		sidebarPosition = {
			x: event.clientX - dragOffset.x,
			y: event.clientY - dragOffset.y
		};
		
		// Get the actual map container boundaries rather than using static values
		const mapRect = mapContainer.getBoundingClientRect();
		
		// Get the sidebar element to determine its actual dimensions
		const sidebarElements = document.querySelectorAll('.sidebar-overlay');
		if (sidebarElements.length > 0) {
			const sidebarRect = sidebarElements[0].getBoundingClientRect();
			const sidebarWidth = sidebarRect.width;
			const sidebarHeight = sidebarRect.height;
			
			// Use the relative position within the map container
			// We need to account for the map's position on the page
			const relativeX = event.clientX - mapRect.left - dragOffset.x;
			const relativeY = event.clientY - mapRect.top - dragOffset.y;
			
			// Keep sidebar within map boundaries
			sidebarPosition.x = Math.max(0, Math.min(mapRect.width - sidebarWidth, relativeX));
			sidebarPosition.y = Math.max(0, Math.min(mapRect.height - sidebarHeight, relativeY));
		}
	}
	
	function handleDragEnd() {
		isDragging = false;
		
		// Save the current position when dragging ends
		lastSidebarPosition = {...sidebarPosition};
	}

	// Make sure to adjust position when sidebar is shown
	$: if (showSidebar && lastSidebarPosition) {
		adjustSidebarPosition();
	}
</script>

<div class="w-full h-full relative" class:hidden={!isVisible}>
	<div 
		bind:this={mapContainer} 
		class="map w-full h-full"
	>
		{#if hexId}
			<div class="hex-info">Selected Hexagon: {hexId}</div>
		{/if}
	</div>

	<!-- Lens Selector -->
	<div class="lens-selector">
		<div class="mapboxgl-ctrl mapboxgl-ctrl-group">
			<select 
				bind:value={selectedLens}
				class="lens-select"
				aria-label="Select lens type"
			>
				{#each lensOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
			<div class="select-arrow">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
					<path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
				</svg>
			</div>
		</div>
	</div>

	<!-- Overlay sidebar when hexagon is selected -->
	{#if showSidebar && hexId}
		<div 
			class="sidebar-overlay"
			style="left: {sidebarPosition.x}px; top: {sidebarPosition.y}px;"
		>
			<div class="sidebar-header" 
				on:mousedown={handleDragStart}
				role="button"
				tabindex="0"
				on:keydown={e => e.key === 'Enter' && handleDragStart(e)}
			>
				<div class="flex items-center">
					<svg class="drag-handle mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M5 9H19M5 15H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
					</svg>
					<span class="text-white font-medium cursor-move">Hexagon {hexId}</span>
				</div>
				<button 
					class="text-gray-300 hover:text-white" 
					on:click={closeSidebar}
				>×</button>
			</div>
			<div class="sidebar-content">
				<MapSidebar 
					{selectedLens}
					{hexId}
					isOverlay={true}
				/>
			</div>
		</div>
	{/if}
</div>

<style>
	.map {
		width: 100%;
		height: 100%;
		position: relative;
		background-color: #111;
	}

	.hex-info {
		position: absolute;
		bottom: 10px;
		left: 10px;
		background-color: rgba(31, 41, 55, 0.8);
		color: white;
		padding: 5px 10px;
		border-radius: 9999px;
		font-size: 14px;
		z-index: 1;
	}
	
	.hidden {
		display: none;
	}

	/* Sidebar overlay styles */
	.sidebar-overlay {
		position: absolute;
		width: min(400px, 40vw);
		max-height: 90vh;
		background-color: #1f2937;
		border-radius: 0.75rem;
		box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
		overflow: hidden;
		z-index: 1000;
		display: flex;
		flex-direction: column;
	}

	.sidebar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		background-color: #111827;
		border-bottom: 1px solid #374151;
		cursor: move; /* Indicate draggable */
		user-select: none; /* Prevent text selection during drag */
	}

	.sidebar-header .drag-handle {
		color: #9ca3af; /* gray-400 */
		cursor: grab;
	}
	
	.sidebar-header:active .drag-handle {
		cursor: grabbing;
	}

	.sidebar-header button {
		font-size: 1.5rem;
		line-height: 1;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0 0.5rem;
	}

	.sidebar-content {
		overflow-y: auto;
		flex: 1;
		max-height: 70vh;
	}

	:global(.mapboxgl-ctrl-top-right) {
		top: 10px !important;
		right: 10px !important;
	}

	:global(.mapboxgl-ctrl-geocoder) {
		min-width: 250px;
	}

	/* Lens selector styling */
	.lens-selector {
		position: absolute;
		top: 10px;
		right: 320px; /* Position to the left of the search box */
		z-index: 10;
	}

	.lens-select {
		appearance: none;
		background: transparent;
		color: #333;
		border: none;
		padding: 7px 30px 7px 10px;
		font-size: 14px;
		cursor: pointer;
		width: 100%;
	}

	.select-arrow {
		position: absolute;
		right: 8px;
		top: 50%;
		transform: translateY(-50%);
		pointer-events: none;
		color: #333;
	}

	.mapboxgl-ctrl.mapboxgl-ctrl-group {
		position: relative;
		background: #fff;
		border-radius: 4px;
	}

	select:focus {
		outline: none;
	}
</style>









