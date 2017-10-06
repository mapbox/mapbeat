![deprecated](https://c1.staticflickr.com/5/4396/36704337791_4268261089_n.jpg)

# [mapbeat](https://mapbox.com/mapbeat) - OpenStreetMap changes, as they happen.

A [websocket server](https://github.com/mapbox/mapbeat/blob/mb-pages/index.js) that listens to GeoJSON stream of changes in OpenStreetMap and broadcasts to [clients](https://github.com/mapbox/mapbeat/blob/mb-pages/map.js). The clients render this on a [Mapbox GL map](https://github.com/mapbox/mapbeat/blob/mb-pages/index.html).


#### Socket server setup

* `git clone https://github.com/mapbox/mapbeat.git`
* `npm install`
* Start the websocket server - `node index.js`

#### Front-end setup

* Point [the client](https://github.com/mapbox/mapbeat/blob/mb-pages/map.js#L1) to the socket server

##### Tiles

If you go to index.html, the map will show the world divided into zoom 7 tiles, the tiles will light up when a feature in that tile is changed. The code is in js/tiles.js and is built using browserify into dist/bundle.js. You can see the map in light or dark variants. Just pass a `style` query parameter, like https://mapbox.com/mapbeat?style=light. The default is dark.

If you pass `beat=true` query parameter in the URL, each change will make a beat based on the coordinates.

![mapbeat](https://cloud.githubusercontent.com/assets/371666/16336544/f5667ad6-3a2b-11e6-988e-0e85289a6ef3.gif)
