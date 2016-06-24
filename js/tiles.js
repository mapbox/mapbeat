// Websocket client that connect to the stream server and render changes on a z7 tiled map.
// This script and node libraries used are built into dist/build.js using browserify and served in tiles.html.

var cover = require('tile-cover');
var socket = io('https://mapbeat-lambda-staging.tilestream.net:443');
var turfCentroid = require('turf-centroid');
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

    var t = new track();
    function show(data) {
        var filter = ["any"];
        var usernames = '';
        var tags = '';
        // var firstFeatureCentroid = turf.centroid(data[0]);
        // var lat = Math.floor(firstFeatureCentroid.geometry.coordinates[0]);
        // var lng = Math.floor(firstFeatureCentroid.geometry.coordinates[1]);
        // t.tri().beat(2).notes(lat,lng);
        var centroids = data.map(function(feature) {
            var centroid = turfCentroid(feature);
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
    }, 10);
});

function getTile(feature) {
    var tiles = cover.tiles(feature.geometry, {min_zoom: 7, max_zoom: 7});
    feature.properties.tiles = tiles;
    return feature;
}