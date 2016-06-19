# [mapbeat](mapbox.com/mapbeat) - OpenStreetMap changes, as they happen.

A [websocket server](https://github.com/mapbox/mapbeat/blob/mb-pages/index.js) that listens to GeoJSON stream of changes in OpenStreetMap and broadcasts to [clients](https://github.com/mapbox/mapbeat/blob/mb-pages/map.js). The clients render this on a [Mapbox GL map](https://github.com/mapbox/mapbeat/blob/mb-pages/index.html).

#### Setup

* `git clone https://github.com/mapbox/mapbeat.git`
* `npm install`
* Start the websocket server - `node index.js`
* Point [the client](https://github.com/mapbox/mapbeat/blob/mb-pages/map.js#L1) to the socket server
* Start the map - go to index.html in your browser.


