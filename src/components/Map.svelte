<script>
	// @ts-nocheck
	import { onMount, onDestroy } from "svelte";
	import { Map, GeolocateControl, Popup } from "mapbox-gl";
	import { MapboxSearchBox } from "@mapbox/search-js-web";
	import * as h3 from "h3-js";
	import "../../node_modules/mapbox-gl/dist/mapbox-gl.css";

	// import { SubmitForm, SchemaForm } from "@restspace/svelte-schema-form";
	// import "@restspace/svelte-schema-form/css/layout.scss";
	// import "@restspace/svelte-schema-form/css/basic-skin.scss";

	import { getContext } from "svelte";
	import HoloSphere from "holosphere";

	let holosphere =  getContext('holosphere') || new HoloSphere('Holons');

	let schema = {
		type: "object",
		properties: {
			x: { type: "string" },
		},
	};
	let value = {};

	const submit = (e) => {
		alert(JSON.stringify(e.detail.value, undefined, 2));
	};

	let map;
	let mapContainer;
	let ID;
	let lense = "hubs";

	let lng, lat, zoom, shapes;
	lng = -71.224518;
	lat = 42.213995;
	zoom = 9;

	// Create a local store to cache data from GUN
	let store = {};

	// // Creates a listener that iterates over keys found in the "todo" node in GUN
	// gun.get(clickedHex).map().on(function (todo, key) {
	// 	console.log(todo, key)
	// 	if (todo) {
	// 		// Updates the store with the new value
	// 		store[key] = todo;
	// 	} else {
	// 		// A key may contain a null value (if data has been deleted/set to null)
	// 		// if so, we remove the item from the store
	// 		delete store[key];
	// 		store = store;
	// 	}
	// });
	// The below lines listens for updates in the store and creates
	// more convenient variables for use in markup
	$: entries = Object.entries(store);
	$: done = entries.filter(([key, entries]) => entries.done).length;

	const create = (key) => {
		holosphere.put(ID,lense,{ content: key, done: false });
	};
	const update = (key, value) =>
		holosphere.gun.get(ID).get(lense).get(key).get("done").put(value);
	const remove = (key) => holosphere.delete(ID,lense);

	function goToHex(hex, scale) {
		map.flyTo({
			center: h3.cellToLatLng(hex),
			zoom: 10,
		});
	}

	// Assuming you have an array of hexagon IDs
	function highlightNearbyHexagons(map, hex) {
		let hexagonData = {};
		const kRing = h3.gridDisk(hex, 1);
		// Reduce hexagon list to a map with random values
		let hexagons = kRing.reduce(
			(res, hexagon) => ({ ...res, [hexagon]: Math.random() }),
			{},
		);
		kRing.forEach((hexID) => {
			hexagonData[hexID] = {
				height: Math.random() * 6500, // maxHeight is the maximum height you want
				color: getRandomColor(), // A function to generate random colors
			};
		});
		// Get the hexagon boundaries
		const hexBoundaries = kRing.map((hexagon) =>
			h3.cellToBoundary(hexagon, true),
		);

		// Update the source data with the new hexagon to highlight.
		map.getSource("random").setData({
			type: "FeatureCollection",
			features: hexBoundaries.map((hexBoundary, index) => ({
				type: "Feature",
				properties: {
					id: kRing[index],
					height: Math.random() * 1000,
					color: getRandomColor(),
				},
				geometry: {
					type: "Polygon",
					coordinates: [hexBoundary], // Close the polygon by adding the first point again
				},
			})),
		});
	}

	function getRandomColor() {
		var letters = "0123456789ABCDEF";
		var color = "#";
		for (var i = 0; i < 6; i++) {
			color += letters[Math.floor(Math.random() * 16)];
		}
		return color;
	}

	function highlightHexagon(map, hex) {
		if (!hex) return;
		// Get the hexagon boundaries
		const hexBoundary = h3.cellToBoundary(hex, true);

		let coordinates = [];
		for (let i = 0; i < hexBoundary.length; i++) {
			coordinates.push([hexBoundary[i][0], hexBoundary[i][1]]);
		}

		const hexGeoJson = {
			type: "Feature",
			properties: {},
			geometry: {
				type: "Polygon",
				coordinates: [coordinates], // Close the polygon by adding the first point again
			},
		};

		// Update the source data with the new hexagon to highlight.
		map.getSource("clicked-hex-area").setData({
			type: "FeatureCollection",
			features: [hexGeoJson],
		});
	}
	function highlightHexagons(map, lense) {
		let features = [];
		//remove all features
		map.getSource("h3-hex-areas").setData({
			type: "FeatureCollection",
			features: features,
		});

		if (!lense || !shapes) return;
		shapes.map( async(hex) => {
			holosphere.gun.get(hex) //this way is much faster (using realtime db)
				.get(lense)
				.map()
				.once((data, key) => {
				 if (data) {
			// holosphere.get(hex, lense).then( data =>{ // this way is slow as it needs to wait for the promise
			// 		if (data.length>0) {
						console.log(data);
						//Highlight hexagon
						const hexBoundary = h3.cellToBoundary(hex, true);

						let coordinates = [];
						for (let i = 0; i < hexBoundary.length; i++) {
							coordinates.push([
								hexBoundary[i][0],
								hexBoundary[i][1],
							]);
						}

						const hexGeoJson = {
							type: "Feature",
							properties: {},
							geometry: {
								type: "Polygon",
								coordinates: [coordinates], // Close the polygon by adding the first point again
							},
						};
						features.push(hexGeoJson);
						// Update the source data with the new hexagon to highlight.
						map.getSource("h3-hex-areas").setData({
							type: "FeatureCollection",
							features: features,
						});
					}
				});
		});

		return features;
	}

	function getZoom(resolution) {
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
		];

		for (let [res, z] of resToZoom) {
			if (resolution === res) return z;
		}
		return 21.9;
	}

	function getResolution(zoom) {
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

	function getCellInfo(cell) {
		holosphere.gun.get(cell)
			.get(content)
			.on((data) => {
				console.log(data);
			});
	}

	function updateData(map) {
		zoom = map.getZoom();
		lng = map.getCenter().lng;
		lat = map.getCenter().lat;
		shapes = map.shapes;
	}

	function renderHexes(map, lense) {
		const latitudeMax = 90;
		const latitudeMin = -latitudeMax;
		const longitudeMax = 180;
		const longitudeMin = -longitudeMax;

		const extraFillArea = 0.5;
		const blueColor = "#ffffff"; //'#0080ff';
		const borderLayerName = "hex-layer-border";
		const hexSourceName = "hex-source";

		var currentZoom = map.getZoom();
		var h3res = getResolution(currentZoom);
		// console.log("Resolution: " + JSON.stringify(h3res));

		const iw = window.innerWidth;
		const ih = window.innerHeight;
		const cUL = map.unproject([0, 0]).toArray(); // Upper left
		const cLR = map.unproject([iw, ih]).toArray(); // Lower right
		const x1 = Math.min(cUL[0], cLR[0]);
		const x2 = Math.max(cUL[0], cLR[0]);
		const y1 = Math.min(cUL[1], cLR[1]);
		const y2 = Math.max(cUL[1], cLR[1]);
		const dh = x2 - x1;
		const dv = y2 - y1;
		// console.log(
		// 	`REAL Coordinates x1:${x1} x2:${x2} y1:${y1} y2:${y2} dh:${dh} dv:${dv}`,
		// );

		let x1withBuffer = x1 - dh * extraFillArea;
		let x2withBuffer = x2 + dh * extraFillArea;
		let y1withBuffer = y1 - dv * extraFillArea;
		let y2withBuffer = y2 + dv * extraFillArea;
		let fullX = x1withBuffer < longitudeMin || x2withBuffer > longitudeMax;

		x1withBuffer = Math.max(x1withBuffer, longitudeMin);
		x2withBuffer = Math.min(x2withBuffer, longitudeMax);
		y1withBuffer = Math.max(y1withBuffer, latitudeMin);
		y2withBuffer = Math.min(y2withBuffer, latitudeMax);
		// console.log(
		// 	`BUFF Coordinates x1:${x1withBuffer} x2:${x2withBuffer} y1:${y1withBuffer} y2:${y2withBuffer} fullView:${fullX}`,
		// );

		let coordinates = [];
		if (fullX) {
			coordinates.push([
				[latitudeMin, longitudeMin],
				[latitudeMin, 0],
				[latitudeMax, 0],
				[latitudeMax, longitudeMin],
			]);

			coordinates.push([
				[latitudeMin, 0],
				[latitudeMin, longitudeMax],
				[latitudeMax, longitudeMax],
				[latitudeMax, 0],
			]);
		} else {
			const xIncrement = 180;
			let lowerX = x1withBuffer;
			while (lowerX < longitudeMax && lowerX < x2withBuffer) {
				let upperX = Math.min(lowerX + xIncrement, x2withBuffer, 180);
				coordinates.push([
					[
						[y2withBuffer, lowerX],
						[y2withBuffer, upperX],
						[y1withBuffer, upperX],
						[y1withBuffer, lowerX],
					],
				]);
				// console.log(
				// 	`PUSH Coordinates x1:${lowerX} x2:${upperX} y1:${y1withBuffer} y2:${y2withBuffer}`,
				// );
				lowerX += xIncrement;
			}
		}

		shapes = [].concat(
			...coordinates.map((e) => {
				return h3.polygonToCells(e, h3res);
			}),
		);
		var innershapes = [].concat(
			...coordinates.map((e) => {
				return h3.polygonToCells(e, h3res + 1);
			}),
		);
		var hexBoundaries = [];
		var pentaBoundaries = [];
		var innerBoundaries = [];

		for (var i = 0; i < shapes.length; i++) {
			let h = h3.cellToBoundary(shapes[i], true);
			if (h.find((e) => e[0] < -128) !== undefined) {
				h = h.map((e) => (e[0] > 0 ? [e[0] - 360, e[1]] : e));
			}

			if (h3.isPentagon(shapes[i])) {
				pentaBoundaries.push(h);
			} else {
				hexBoundaries.push(h);
			}
		}
		for (var i = 0; i < innershapes.length; i++) {
			let h = h3.cellToBoundary(innershapes[i], true);
			if (h.find((e) => e[0] < -128) !== undefined) {
				h = h.map((e) => (e[0] > 0 ? [e[0] - 360, e[1]] : e));
			}
			innerBoundaries.push(h);
		}

		let highlighted = highlightHexagons(map, lense);

		// console.log(
		// 	`currentZoom: ${currentZoom}, resolution: ${h3res}, shapes: ${shapes.length}`,
		// );

		var featureCollection = {
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					properties: { color: "gray" },
					geometry: {
						type: "Polygon",
						coordinates: innerBoundaries,
					},
				},
				{
					type: "Feature",
					properties: { color: "white" },
					geometry: {
						type: "Polygon",
						coordinates: hexBoundaries,
					},
				},
				{
					type: "Feature",
					properties: { color: "white" },
					geometry: {
						type: "Polygon",
						coordinates: pentaBoundaries,
					},
				}, //,
				// {
				// 	type: "Feature",
				// 	properties: { color: "blue" },
				// 	geometry: {
				// 		type: "Fill",
				// 		coordinates: highlighted,
				// 	},
				// },
			],
		};

		const hexSource = map.getSource(hexSourceName);
		if (hexSource !== undefined) {
			hexSource.setData(featureCollection);
		} else {
			var hexGeoJson = {
				type: "geojson",
				data: featureCollection,
			};
			map.addSource(hexSourceName, hexGeoJson);
			map.addLayer({
				id: borderLayerName,
				source: hexSourceName,
				type: "line",
				layout: {},
				paint: {
					"line-color": ["get", "color"],
					"line-width": 1,
				},
			});
		}
	}

	onMount(() => {
		const initialState = { lng: lng, lat: lat, zoom: zoom, shapes: shapes };

		let hexagonData = {};
		let accessToken =
			"pk.eyJ1IjoicnZhbGVudGkiLCJhIjoiY2tncnMxeG81MDNjaTJybWpxOWhrOWpmZiJ9.v2W_bicM22r4YX4pCyRvHQ";
		let config = {
			lng: 13.7496496,
			lat: 42.8917571,
			zoom: 0,
		};

		map = new Map({
			container: mapContainer,
			accessToken: accessToken,
			center: [config.lng, config.lat],
			zoom: config.zoom + 2,
			style: "mapbox://styles/mapbox/satellite-streets-v12",
			projection: "globe",
		});

		const search = new MapboxSearchBox();
		search.accessToken = accessToken;
		map.addControl(search);

		map.addControl(
			new GeolocateControl({
				positionOptions: {
					enableHighAccuracy: true,
				},
				// When active the map will receive updates to the device's location as it changes.
				trackUserLocation: true,
				// Draw an arrow next to the location dot to indicate which direction the device is heading.
				showUserHeading: true,
			}),
		);


		map.on("style.load", () => {
			map.setFog({
				color: "rgb(186, 210, 235)", // Lower atmosphere
				"high-color": "rgb(36, 92, 92)", // Upper atmosphere
				"horizon-blend": 0.02, // Atmosphere thickness (default 0.2 at low zooms)
				"space-color": "rgb(17, 24, 39)", // Background color
				"star-intensity": 0.6, // Background star brightness (default 0.35 at low zoooms )
			});
		});

		map.on("load", function () {
			["zoomend", "dragend", "resize"].forEach((event) => {
				map.on(event, () => {
					updateData(map);
					renderHexes(map, lense);
				});
			});

			map.addSource("random", {
				type: "geojson",
				data: {
					type: "FeatureCollection",
					features: [],
				},
			});

			map.addSource("clicked-hex-area", {
				type: "geojson",
				data: {
					type: "FeatureCollection",
					features: [],
				},
			});

			map.addSource("h3-hex-areas", {
				type: "geojson",
				data: {
					type: "FeatureCollection",
					features: [],
				},
			});

			map.addLayer({
				id: "highlighted-hex",
				type: "fill",
				source: "h3-hex-areas",
				paint: {
					"fill-color": "green",
					"fill-opacity": 0.6,
					"fill-outline-color": "rgba(255, 0, 0, 1)",
				},
			});

			map.addLayer({
				id: "clicked-hex",
				type: "fill",
				source: "clicked-hex-area",
				paint: {
					"fill-color": "blue",
					"fill-opacity": 0.6,
					"fill-outline-color": "rgba(255, 0, 0, 1)",
				},
			});

			map.addLayer({
				id: "3d-hexagons",
				type: "fill-extrusion",
				source: "random", // Your hexagon data source
				paint: {
					// Use an expression to set the fill-extrusion-height based on the lookup table
					"fill-extrusion-height": [
						"get",
						["to-string", ["get", "id"]],
						["literal", hexagonData],
					],
					// Set the fill-extrusion-color similarly
					"fill-extrusion-color": [
						"get",
						["to-string", ["get", "id"]],
						["literal", hexagonData],
					],
					"fill-extrusion-opacity": 0.6,
				},
			});

			renderHexes(map, lense);
		});

		
		map.on("click", async (e) => {
			ID = h3.latLngToCell(
				e.lngLat.lat,
				e.lngLat.lng,
				getResolution(map.getZoom()),
			);

			store = await holosphere.get(ID, lense);
			console.log(store)
			
			//highlightNearbyHexagons(map,clickedHex)

			highlightHexagon(map, ID);
			//localStorage.put("ID",ID)
			// new Popup().setLngLat(e.lngLat).setHTML(clickedHex).addTo(map);
		});

		map.on("contextmenu", (e) => {
			console.log(e.lngLat);
			const clickedHex = h3.latLngToCell(
				e.lngLat.lat,
				e.lngLat.lng,
				getResolution(map.getZoom()),
			);
			let form = `<form bind:this={form}>
		<label for="fname">Hex:</label><br />
		<input type="text" id="fname" name="fname" value="${clickedHex}" /><br />
		<label for="lname">Need:</label><br />
		<input type="text" id="lname" name="lname" value="Type the need you are sensing" /><br /><br />
		<label for="lname">Frequency:</label><br />
		<input type="checkbox" id="lname" name="lname" value="daily" />daily<br />
		<input type="checkbox" id="lname" name="lname" value="weekly" />weekly<br />
		<input type="checkbox" id="lname" name="lname" value="fortnightly" />fortnightly<br />
		<input type="checkbox" id="lname" name="lname" value="monthly" />monthly<br />
		<input type="checkbox" id="lname" name="lname" value="quarterly" />quarterly<br />
		<input type="checkbox" id="lname" name="lname" value="yearly" />yearly<br />
		<input type="submit" value="Submit" />
	</form>`;
			new Popup().setLngLat(e.lngLat).setHTML(form).addTo(map);
			highlightHexagon(map, clickedHex);
			//highlightNearbyHexagons(map, clickedHex);
		});
	});

	onDestroy(() => {
		//map.remove();
	});
</script>

<head> </head>
<!-- <SubmitForm {schema} {value} on:submit={submit} />

<SchemaForm {schema} {value} /> -->
<div class="map-wrap">
	<div class="map" bind:this={mapContainer} />
	<div class="sidebar">
		Longitude: {lng.toFixed(4)} | Latitude: {lat.toFixed(4)} | Zoom: {zoom.toFixed(
			2,
		)} | Hex: {ID}
	</div>
</div>

<div class="content">
	<h1>Holonic map</h1>
	<input
		bind:value={lense}
		placeholder="lense"
		on:keyup={async (e) => {
			lense = e.target.value;
			store = await holosphere.get(ID, lense);
			renderHexes(map, lense);
		}}
		on:change={async (e) => {
			store = await holosphere.get(ID, lense);
			renderHexes(map, lense);
		}}
	/>
	<input
		placeholder="add content"
		on:change={(e) => create(e.target.value) && (e.target.value = "")}
	/>
	<br />
	Found {entries.length} entries:
	{#each entries as [key, entry]}
		{#if entry.content}
			<div>{entry.content}</div>
		{/if}
	{/each}
	<!-- {#each todos as [key, todo]}
			<div id={key}>
				<input
					type="checkbox"
					checked={todo.done}
					on:change={() => update(key, !todo.done)}
				/>
				{todo.title}
				<a href="/" on:click|preventDefault={() => remove(key)}
					>remove</a
				>
				{todo.done ? "✅" : "❌"}
			</div>
		{/each} -->
</div>

<style>
	.map {
		position: absolute;
		width: 100%;
		height: 100%;
	}

	.content {
		background-color: rgb(35 55 75 / 90%);
		color: #fff;
		padding: 6px 60px;
		font-family: monospace;
		z-index: 1;
		position: relative;
		left: 12px;
		bottom: 12px;
		margin: 0;
		border-radius: 4px;
	}

	.floatingbox {
		position: absolute;
		top: 0;
		right: 0;
		width: 300px;
		height: 100%;
		background-color: #f1f1f1;
		border: 1px solid black;
		padding: 20px;
	}

	.sidebar {
		background-color: rgb(35 55 75 / 90%);
		color: #fff;
		padding: 6px 12px;
		font-family: monospace;
		z-index: 1;
		position: relative;
		top: 0;
		left: 0;
		margin: 12px;
		border: 12px;
		border-radius: 4px;
	}
</style>
