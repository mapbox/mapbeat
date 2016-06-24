// Websocket client that connect to the stream server and render changes on a z7 tiled map.
// This script and node libraries used are built into dist/build.js using browserify and served in tiles.html.

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
        "fill-outline-color": "red"
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
                    queue.push(f);
                }
            } else {
                queue.push(f);
            }
            if (first) {
                first = false;
                show(queue.splice(0, 3));
            }
        }
    });

    function show(data) {
        if (data.length === 0) {
            $('.info').addClass('hidden');
        }
        var filter = ["any"];
        var usernames = '';
        var tags = '';
        data.forEach(function (d) {
            var featureTagKeys = Object.keys(d.properties).filter(function(key) {
                if (key.indexOf('osm') !== -1 || key.indexOf('tiles') !== -1) {
                    return false;
                } else {
                    return true;
                }
            });
            var tiles = d.properties.tiles;
            usernames = usernames + '<br>' + d.properties['osm:user'];
            tags = tags + '<br>' +featureTagKeys.join('\n');
            tiles.forEach(function (t) {
                var index = t.join(',');
                var f = ["==", "index", index];
                filter.push(f);
            });
        });
        $('.info').removeClass('hidden');
        $('#description').html(usernames);
        $('#tags').html(tags);
        map.setFilter("onlayer", filter);
    }

    setInterval(function() {
        if (queue.length) {
            show(queue.splice(0, 10));
        } else {
            map.setFilter('onlayer', ['==', 'index', ""]);
        }
    }, 50);
});

function getTile(feature) {
    var tiles = cover.tiles(feature.geometry, {min_zoom: 7, max_zoom: 7});
    feature.properties.tiles = tiles;
    return feature;
}