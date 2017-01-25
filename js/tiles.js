// Websocket client that connect to the stream server and render changes on a z7 tiled map.
// This script and node libraries used are built into dist/build.js using browserify and served in tiles.html.

var _ = require('lodash');
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
    zoom: 1.5,
    hash: true // starting zoom,
});

var tileSource = {
    "type": "vector",
    "url": "mapbox://geohacker.aeh6ayo2"
};

map.on('style.load', function () {
    $('.info').addClass(style);
    map.addSource('data', tileSource);
    map.addLayer(offLayer);
    map.addLayer(onLayer);

    socket.on('data', function (d) {
        $('#map').removeClass('loading');
        var features = JSON.parse(d.data);
        features.forEach(function (feature) {
            queue.push(feature);
            if (first) {
                first = false;
                show(queue.splice(0, 5));
            }
        });
    });

    if (params.beat === 'true') {
        var trk = new track();
    }
    function show(data) {
        if (data.length === 0) {
            $('.info').addClass('hidden');
        }
        var filter = ["any"];
        var usernames = [];
        var tags = [];

        data.forEach(function (d) {
            if (d.country) {
                usernames.push(d.user + ', '+ d.country);
            } else {
                usernames.push(d.user);
            }
            tags.push(d.tags);

            var tiles = d.tiles;
            tiles.forEach(function (t) {
                var index = t.join(',');
                var f = ["==", "index", index];
                beat(t, trk);
                filter.push(f);
            });
        });
        var usernameString = _.uniq(usernames).join('<br>');
        var tagString = _.uniq(_.flattenDeep(tags)).join('\n <br>');

        $('.info').removeClass('hidden');
        $('#description').html(usernameString);
        $('#tags').html(tagString);
        map.setFilter("onlayer", filter);
    }

    setInterval(function() {
        if (queue.length) {
            show(queue.splice(0, 5));
        } else {
            $('.info').addClass('hidden');
            map.setFilter('onlayer', ['==', 'index', ""]);
        }
    }, 600);
});

function getTile(feature) {
    var tiles = cover.tiles(feature.geometry, {min_zoom: 7, max_zoom: 7});
    feature.properties.tiles = tiles;
    return feature;
}

function beat(tile, trk) {
    // for handling beats
    if (params.beat === 'true') {
        trk.sample();
        clock.tempo = tile.length * 20;
        trk.beat32(2,2).notes(1, tile[0], tile[1]);
    }

}