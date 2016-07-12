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
        var features = JSON.parse(d.data);
        features.forEach(function (feature) {
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
    });

    if (params.beat === 'true') {
        var t = new track();
    }
    function show(data) {
        if (data.length === 0) {
            $('.info').addClass('hidden');
        }
        var filter = ["any"];
        var usernames = '';
        var tags = '';

        // for handling beats
        if (params.beat === 'true') {
            var centroids = data.map(function(feature) {
                var centroid = turf.centroid(feature);
                return [centroid.geometry.coordinates[0], centroid.geometry.coordinates[1]];
            }).reduce(function(memo, val, index, array) {
                var lng = (110 / 180) * val[0];
                var lat = (110 / 90) * val[1];
                memo.push(Math.abs(Math.round(lng)));
                memo.push(Math.abs(Math.round(lat)));
                return memo;
            }, []);
            t.sample();
            clock.tempo = data.length * 20;
            // console.log(centroids);
            t.beat32(2,2).notes.apply(t, centroids);
        }

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
    }, 10);
});

function getTile(feature) {
    var tiles = cover.tiles(feature.geometry, {min_zoom: 7, max_zoom: 7});
    feature.properties.tiles = tiles;
    return feature;
}