# [mapbeat](https://mapbox.com/mapbeat) - OpenStreetMap changes, as they happen.

A [websocket server](https://github.com/mapbox/mapbeat/blob/mb-pages/index.js) that listens to GeoJSON stream of changes in OpenStreetMap and broadcasts to [clients](https://github.com/mapbox/mapbeat/blob/mb-pages/map.js). The clients render this on a [Mapbox GL map](https://github.com/mapbox/mapbeat/blob/mb-pages/index.html).


#### Socket server setup

* `git clone https://github.com/mapbox/mapbeat.git`
* `npm install`
* Start the websocket server - `node index.js`

#### Front-end setup

* Point [the client](https://github.com/mapbox/mapbeat/blob/mb-pages/map.js#L1) to the socket server

##### Map

To see the features on a map - go to index.html in your browser. The map will show each feature, one after the other. You can filter for changes happening in a bounding box by passing a `bbox` (xMin, yMin, xMax, yMax) query parameter in the URL. Like https://mapbox.com/mapbeat/?bbox=55.28,-7.78,108.72,46.17

##### Tiles

If you go to tiles.html, the map will show the world divided into zoom 7 tiles, the tiles will light up when a feature in that tile is changed. The code is in js/tiles.js and is built using browserify into dist/bundle.js. You can see the map in light or dark variants. Just pass a `style` query parameter, like https://mapbox.com/mapbeat/tiles.html?style=light. The default is dark.