// Websocket client that connect to the stream server and render changes on a z7 tiled map.
// This script and node libraries used are built into dist/build.js using browserify and served in tiles.html.

var cover = require('tile-cover');
var socket = io('https://mapbeat-lambda-staging.tilestream.net:443');
var queue = [];
var first = true;
var params = URI.parseQuery(window.location.search);
var style = params.style || 'dark';
var colors = {
    'dark': {
        'style': 'mapbox://styles/geohacker/cipskrw39002lb9m9jsph8atl',
        'offlayer': {
            'fill-color': 'black',
            'fill-outline-color': '#3b3b3b'
        },
        'onlayer': {
            'fill-color': '#86fd89',
            'fill-outline-color': '#86fd89'
        }
    },
    'light': {
        'style': 'mapbox://styles/geohacker/cipp7whj7003ldfm1oqhxh1yg',
        'offlayer': {
            'fill-color': '#d7dce7',
            'fill-outline-color': 'white'
        },
        'onlayer': {
            'fill-color': 'red',
            'fill-outline-color': 'red'
        }
    }
};

var offLayer = {
    "id": "offlayer",
    "type": "fill",
    "source": "data",
    "source-layer": "z7",
    "paint": {
        "fill-color": colors[style]['offlayer']['fill-color'],
        "fill-outline-color": colors[style]['offlayer']['fill-outline-color']
    }
};


var onLayer = {
    "id": "onlayer",
    "type": "fill",
    "source": "data",
    "source-layer": "z7",
    "paint": {
        "fill-color": colors[style]['onlayer']['fill-color'],
        "fill-outline-color": colors[style]['onlayer']['fill-outline-color']
    },
    "filter": ["==", "index", ""]
};

mapboxgl.accessToken = 'pk.eyJ1IjoiZ2VvaGFja2VyIiwiYSI6ImFIN0hENW8ifQ.GGpH9gLyEg0PZf3NPQ7Vrg';
var map = new mapboxgl.Map({
    container: 'map', // container id
    style: colors[style]['style'], //stylesheet location
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

map.on('style.load', function () {
    $('.info').addClass(style);
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
        var filter = ["any"];
        var usernames = '';
        var tags = '';
        data.forEach(function (d) {
            var featureTagKeys = Object.keys(d.properties).filter(function(key) {
                return key.indexOf('osm') === -1;
            });
            var tiles = d.properties.tiles;
            usernames = usernames + '<br/>' + d.properties['osm:user'];
            tags = tags + featureTagKeys.join('<br/>');
            tiles.forEach(function (t) {
                var index = t.join(',');
                var f = ["==", "index", index];
                filter.push(f);
            });
        });
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