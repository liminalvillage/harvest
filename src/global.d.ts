/// <reference types="@types/mapbox-gl" />

declare module '@mapbox/mapbox-gl-geocoder';

declare namespace mapboxgl {
    export type Map = import('mapbox-gl').Map;
    export type MapMouseEvent = import('mapbox-gl').MapMouseEvent;
    export type GeoJSONSource = import('mapbox-gl').GeoJSONSource;
}
