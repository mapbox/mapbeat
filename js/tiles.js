// Websocket client that connect to the stream server and render changes on a map.

var cover = require('tile-cover');
var socket = io('https://mapbeat-lambda-staging.tilestream.net:443');
var queue = [];
var first = true;

mapboxgl.accessToken = 'pk.eyJ1IjoiZ2VvaGFja2VyIiwiYSI6ImFIN0hENW8ifQ.GGpH9gLyEg0PZf3NPQ7Vrg';
var map = new mapboxgl.Map({
    container: 'map', // container id
    style: 'mapbox://styles/geohacker/cipp7whj7003ldfm1oqhxh1yg', //stylesheet location
    center: [6.68, 19.73], // starting position
    zoom: 1.5 // starting zoom,
});

// var dataSource = new mapboxgl.GeoJSONSource({});
var tileSource = {
    "type": "vector",
    "url": "mapbox://geohacker.aeh6ayo2"
};

var params = URI.parseQuery(window.location.search);
var bbox = params.bbox ? getPolygon(params.bbox) : false;

function getPolygon (bboxString) {
    var bbox = bboxString.split(',').map(function (b) {
        return parseInt(b, 10);
    });
    return turf.bboxPolygon(bbox);
}

var offLayer = {
    "id": "offlayer",
    "type": "fill",
    "source": "data",
    "source-layer": "z7",
    "paint": {
        "fill-color": "#d7dce7",
        "fill-outline-color": "white"
    }
};


var onLayer = {
    "id": "onlayer",
    "type": "fill",
    "source": "data",
    "source-layer": "z7",
    "paint": {
        "fill-color": "red",
        "fill-outline-color": "white"
    },
    "filter": ["==", "index", ""]
};


map.on('style.load', function () {
    console.log('map.style', map.style);
    map.addSource('data', tileSource);
    map.addLayer(offLayer);
    map.addLayer(onLayer);

    socket.on('data', function (d) {
        $('#map').removeClass('loading');
        var feature = JSON.parse(d.data);
        if (feature.type && feature.geometry) {
            var f = getTile(feature);
            if (bbox) {
                if (turf.inside(f, bbox)) {
                    // show(f);
                    queue.push(f);
                }
            } else {
                // show(f);
                queue.push(f);
            }
            if (first) {
                first = false;
                // map.fire('mapbeat');
                // show(queue[0]);
                show(queue.splice(0, 3));
            }
        }
    });

    // function show(d) {
    //     var filter = ["all"];
    //     var tiles = d.properties.tiles;
    //     tiles.forEach(function (t) {
    //         var index = t.join(',');
    //         var f = ["==", "index", index];
    //         filter.push(f);
    //     });
    //     map.setFilter("onlayer", filter);
    // }
    function show(data) {
        var filter = ["all"];
        data.forEach(function (d) {
            var tiles = d.properties.tiles;
            tiles.forEach(function (t) {
                var index = t.join(',');
                var f = ["==", "index", index];
                filter.push(f);
            });
        });
        map.setFilter("onlayer", filter);
    }

    // map.on('mapbeat', function () {
    //     show(queue.splice(0, 1));
    // });
    setInterval(function() {
        if (queue.length) {
            show(queue.splice(0, 3));
            // queue.splice(0, 1);
        } else {
            map.setFilter('onlayer', ['==', 'index', ""]);
        }
        // map.fire('mapbeat');
    }, 100);
});

function getTile(feature) {
    var tiles = cover.tiles(feature.geometry, {min_zoom: 7, max_zoom: 7});
    feature.properties.tiles = tiles;
    return feature;
}