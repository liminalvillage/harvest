<script lang="ts">
	import { onMount, onDestroy, getContext, createEventDispatcher} from "svelte";
	import { browser } from "$app/environment";
	import mapboxgl from "mapbox-gl";
	import "mapbox-gl/dist/mapbox-gl.css";
	import * as h3 from "h3-js";
	import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
	import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";
	import { ID } from "../dashboard/store";

	import HoloSphere from 'holosphere';
	import MapSidebar from "./MapSidebar.svelte";
	import HolonNavigator from './Navigator.svelte';

	type LensType = 'quests' | 'needs' | 'offers' | 'communities' | 'organizations' | 'projects' | 'currencies' | 'people' | 'holons';

	let holosphere = getContext('holosphere') as HoloSphere 

	let mapContainer: HTMLElement;
	let holonicContainer: HTMLElement;
	let map: mapboxgl.Map;
	let hexId: string;
	export let selectedLens: LensType = 'quests';
	let isLoading = false;
	let holoSubscriptions = new Map();
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

	const lensOptions: Array<{value: LensType, label: string}> = [
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
						const avgLng = boundary.reduce((sum, [_, lng]) => sum + lng, 0) / boundary.length;
						normalizedBoundary = boundary.map(([lat, lng]) => {
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
					const avgLng = boundary.reduce((sum, [_, lng]) => sum + lng, 0) / boundary.length;
					normalizedBoundary = boundary.map(([lat, lng]) => {
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
	}

	// Add debounce utility
	let moveTimeout: number;
	function debounce(fn: () => void, delay: number) {
		clearTimeout(moveTimeout);
		moveTimeout = setTimeout(fn, delay) as unknown as number;
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

		// Render hexes immediately for smooth visual feedback
		if (selectedLens) renderHexes(map, selectedLens);
		
		// Debounce the subscription update
		debounce(() => {
			if (selectedLens) {
				subscribeToLens(selectedLens);
			}
		}, 300);
	}

	// Modify the subscription management functions
	function subscribeToLens(lens: string) {
		// Only show loading for initial subscription
		if (!holoSubscriptions.has(lens)) {
			isLoading = true;
		}

		// Get the current map bounds
		const bounds = map.getBounds();
		const west = bounds.getWest();
		const east = bounds.getEast();
		const south = bounds.getSouth();
		const north = bounds.getNorth();
		
		// Get current zoom and resolution
		const currentZoom = map.getZoom();
		const h3res = getResolution(currentZoom);
		
		// Generate hexagons for the visible area
		const hexagons = new Set<string>();
		for (let lat = south; lat <= north; lat += (north - south) / 20) {
			for (let lng = west; lng <= east; lng += (east - west) / 20) {
				hexagons.add(h3.latLngToCell(lat, lng, h3res));
			}
		}

		console.log(`[Map] Subscribing to ${lens} for ${hexagons.size} hexagons`);

		// Get existing subscriptions for this lens
		const existingSubscriptions = holoSubscriptions.get(lens) || new Map();
		const newSubscriptions = new Map();
		
		// Subscribe to each visible hexagon
		for (const hex of hexagons) {
			// Reuse existing subscription if available
			if (existingSubscriptions.has(hex)) {
				newSubscriptions.set(hex, existingSubscriptions.get(hex));
				continue;
			}
			
			const subscription = holosphere.subscribe(hex, lens, (data: any, key?: string) => {
				try {
					if (data) {
						// Type assertion since we know lens is a valid LensType
						lensData[lens as LensType].add(hex);
						// Trigger a re-render
						renderHexes(map, selectedLens);
					}
				} catch (error) {
					console.error(`[Map] Error processing subscription data for ${hex}:`, error);
				}
			});
			
			newSubscriptions.set(hex, subscription);
		}
		
		// Clean up old subscriptions that are no longer in view
		for (const [hex, subscription] of existingSubscriptions) {
			if (!newSubscriptions.has(hex)) {
				if (subscription && typeof subscription.off === 'function') {
					try {
						console.log(`[Map] Unsubscribing from ${lens} for hexagon ${hex}`);
						subscription.off();
					} catch (e) {
						console.error(`[Map] Error unsubscribing from ${lens} for ${hex}:`, e);
					}
				}
				// Also remove it from the lens data
				lensData[lens as LensType].delete(hex);
			}
		}
		
		holoSubscriptions.set(lens, newSubscriptions);
		
		// Turn off loading after subscriptions are set up
		isLoading = false;
	}

	function unsubscribeFromLens(lens: LensType) {
		console.log(`[Map] Unsubscribing from lens ${lens}`);
		const subscriptions = holoSubscriptions.get(lens);
		if (subscriptions) {
			// Clear all subscriptions for this lens
			for (const [hexId, subscription] of subscriptions.entries()) {
				if (subscription && typeof subscription.off === 'function') {
					try {
						subscription.off();
					} catch (e) {
						console.error(`[Map] Error unsubscribing from ${lens} for ${hexId}:`, e);
					}
				}
			}
			holoSubscriptions.delete(lens);
			lensData[lens].clear();
		}
	}

	let activeView: 'map' | 'holonic' = 'map';
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
			map.addSource("hexagon-grid", {
				type: "geojson",
				data: { type: "FeatureCollection", features: [] }
			});

			// Base hexagon grid layers
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

			// Initial subscription to default lens
			subscribeToLens(selectedLens);
			renderHexes(map, selectedLens);
			mapInitialized = true;
		});

		// Update these event handlers to maintain subscriptions
		map.on("move", handleMapMove);
		map.on("zoom", handleMapMove);

		map.on("click", async (e: mapboxgl.MapMouseEvent) => {
			console.log("Map clicked", e.lngLat);
			const { lng, lat } = e.lngLat;
			const zoom = map.getZoom();
			const resolution = getResolution(zoom);
			const newHexId = h3.latLngToCell(lat, lng, resolution);
			console.log("Hexagon ID:", newHexId);
			
			// Only update if it's a valid H3 cell
			if (isH3Cell(newHexId)) {
				hexId = newHexId;
				updateSelectedHexagon(newHexId);
			}

			// Log lens data for the clicked hexagon
			try {
				const data = await holosphere.getAll(newHexId, selectedLens);
				console.log(`${selectedLens} data for hexagon ${newHexId}:`, data);
			} catch (error) {
				console.error(`Error fetching ${selectedLens} data:`, error);
			}
		});
	}

	onMount(() => {
		if (browser) {
			// Add a small delay to ensure container is properly sized
			setTimeout(initializeMap, 100);
		}
	});

	// Add cleanup function for map
	function cleanupMap() {
		if (map) {
			map.remove();
			map = null;
			mapInitialized = false;
		}
	}

	let lastSelectedHolonId: string | null = null;

	// Add function to detect holon type
	function isH3Cell(id: string): boolean {
		try {
			return h3.isValidCell(id);
		} catch {
			return false;
		}
	}

	// Update view change handler
	$: if (activeView === 'map') {
		// Small delay to ensure container is ready
		setTimeout(() => {
			initializeMap();
			// Only zoom if we have a valid H3 index
			if (hexId && isH3Cell(hexId)) {
				updateSelectedHexagon(hexId);
			}
		}, 100);
	} else {
		cleanupMap();
	}

	// Update ID store subscription
	$: if ($ID && $ID !== hexId) {
		hexId = $ID;
		// Automatically switch view based on ID type
		if (isH3Cell($ID)) {
			activeView = 'map';
		} else {
			activeView = 'holonic';
		}
		dispatch('holonChange', { id: $ID });
		// Only update map if we're in map view and it's a valid H3 cell
		if (activeView === 'map' && map && isH3Cell($ID)) {
			updateSelectedHexagon($ID);
		}
	}

	// Update the lens selection reactive statement
	$: if (map && selectedLens) {
		// Unsubscribe from all other lenses
		for (const lens of holoSubscriptions.keys()) {
			if (lens !== selectedLens) {
				unsubscribeFromLens(lens);
			}
		}
		// Subscribe to the selected lens
		subscribeToLens(selectedLens);
		renderHexes(map, selectedLens);
	}

	// Update onDestroy to include map cleanup
	onDestroy(() => {
		// Ensure proper cleanup and unsubscription
		if (map) {
			// Remove event listeners
			map.off('move', handleMapMove);
			map.off('zoom', handleMapMove);
			map.off('click');
		}
		
		// Clear all timeouts
		if (moveTimeout) {
			clearTimeout(moveTimeout);
		}
		
		// Complete map cleanup
		cleanupMap();
		
		// Properly unsubscribe from all subscriptions
		for (const [lens, subscriptions] of holoSubscriptions.entries()) {
			for (const [hexId, subscription] of subscriptions.entries()) {
				if (subscription && typeof subscription.off === 'function') {
					try {
						subscription.off();
					} catch (e) {
						console.error(`Error unsubscribing from ${lens} for ${hexId}:`, e);
					}
				}
			}
		}
		holoSubscriptions.clear();
		
		// Clear all lens data to free memory
		Object.keys(lensData).forEach(key => {
			lensData[key as LensType].clear();
		});
	});
</script>

<div class="flex flex-wrap">
    <div class="w-full lg:w-8/12 bg-gray-800 py-6 px-6 rounded-3xl map-container">
        <div class="flex justify-between text-white items-center mb-8">
            <!-- View Toggle -->
            <div class="flex bg-gray-700 rounded-lg p-1">
                <button 
                    class="px-4 py-2 rounded-lg transition-colors {activeView === 'map' ? 'bg-gray-600 text-white' : 'text-gray-300 hover:text-white'}"
                    on:click={() => activeView = 'map'}
                >
                    Map View
                </button>
                <button 
                    class="px-4 py-2 rounded-lg transition-colors {activeView === 'holonic' ? 'bg-gray-600 text-white' : 'text-gray-300 hover:text-white'}"
                    on:click={() => activeView = 'holonic'}
                >
                    Holonic View
                </button>
            </div>
            <!-- Lens Selector (show in both views) -->
            <div class="lens-selector">
                <label for="lens-select">Lens:</label>
                <select id="lens-select" bind:value={selectedLens}>
                    {#each lensOptions as option}
                        <option value={option.value}>{option.label}</option>
                    {/each}
                </select>
            </div>
        </div>

        <div class="view-content">
            {#if isLoading}
                <div class="loading-overlay">
                    <div class="loading-spinner">Loading...</div>
                </div>
            {/if}
            
            {#if activeView === 'map'}
                <div 
                    bind:this={mapContainer} 
                    class="map"
                >
                    {#if hexId}
                        <div class="hex-info">Selected Hexagon: {hexId}</div>
                    {/if}
                </div>
            {:else}
                <div class="holonic-view">
                    <HolonNavigator 
                        on:holonSelect={({ detail }) => {
                            hexId = detail.key;
                            ID.set(detail.key);
                            dispatch('holonChange', { id: detail.key });
                        }}
                    />
                </div>
            {/if}
        </div>
    </div>

    <MapSidebar 
        {selectedLens}
        {hexId}
        {activeView}
        on:holonChange
    />
</div>

<style>
    .map, .holonic-view {
        width: 100%;
        height: 100%;
        position: relative;
    }

    .map-container {
        height: calc(100vh - 64px - 2rem);
        display: flex;
        flex-direction: column;
    }

    .view-content {
        flex: 1;
        position: relative;
        overflow: hidden;
        border-radius: 1.5rem;
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

    :global(.mapboxgl-ctrl-top-right) {
        top: 10px !important;
        right: 10px !important;
    }

    :global(.mapboxgl-ctrl-geocoder) {
        min-width: 250px;
    }

    .lens-selector {
        background-color: transparent;
        padding: 0;
        box-shadow: none;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .lens-selector label {
        font-size: 14px;
        font-weight: 500;
        color: white;
    }

    .lens-selector select {
        padding: 5px 10px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 9999px;
        font-size: 14px;
        background-color: rgba(255, 255, 255, 0.1);
        color: white;
        cursor: pointer;
        min-width: 120px;
    }

    .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(31, 41, 55, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        border-radius: 1.5rem;
    }

    .loading-spinner {
        background: rgba(31, 41, 55, 0.9);
        color: white;
        padding: 1rem;
        border-radius: 0.5rem;
    }

    .holonic-view {
        background-color: rgb(17, 24, 39);
    }
</style>









