// Websocket client that connect to the stream server and render changes on a map.

var socket = io('https://mapbeat-lambda-staging.tilestream.net:443');
var queue = [];
var first = true;

mapboxgl.accessToken = 'pk.eyJ1IjoiZ2VvaGFja2VyIiwiYSI6ImFIN0hENW8ifQ.GGpH9gLyEg0PZf3NPQ7Vrg';
var map = new mapboxgl.Map({
    container: 'map', // container id
    style: 'mapbox://styles/mapbox/outdoors-v9', //stylesheet location
    center: [0, 0], // starting position
    zoom: 1 // starting zoom,
});

var dataSource = new mapboxgl.GeoJSONSource({});
var params = URI.parseQuery(window.location.search);
var bbox = params.bbox ? getPolygon(params.bbox) : false;

function getPolygon (bboxString) {
    var bbox = bboxString.split(',').map(function (b) {
        return parseInt(b, 10);
    });
    return turf.bboxPolygon(bbox);
}

var lineLayer = {
    "id": "line",
    "type": "line",
    "source": "data",
    "layout": {
        "line-join": "round",
        "line-cap": "round"
    },
    "paint": {
        "line-color": "black",
        "line-width": 1
    }
};

var pointLayer = {
    "id": "point",
    "type": "circle",
    "source": "data",
    "paint": {
        "circle-color": "red",
        "circle-radius": 2
    }
};

var polygonLayer = {
    "id": "polygon",
    "type": "fill",
    "source": "data",
    "layout": {},
    "paint": {
        "fill-color": '#7337fc',
        "fill-opacity": 0.5
    }
};

map.on('style.load', function () {
    map.addSource('data', dataSource);
    map.addLayer(polygonLayer);
    map.addLayer(lineLayer);
    map.addLayer(pointLayer);

    socket.on('data', function (d) {
        var feature = JSON.parse(d.data);
        if (feature.type && feature.geometry) {
            if (bbox) {
                if (turf.inside(feature, bbox)) {
                    queue.push(feature);
                }
            } else {
                queue.push(feature);
            }
            if (queue.length && first) {
                first = false;
                $('#map').removeClass('loading');
                map.fire('moveend', {'mapbeat': true});
            }
        }
    });

    map.on('moveend', function (eventData) {
        if (eventData.hasOwnProperty('mapbeat')) {
            setTimeout(function () {
                if (queue.length) {
                    var f = queue[0];
                    var bbox = turf.extent(f);
                    var time = moment(Number(f.properties['osm:timestamp'])).fromNow();
                    var bounds = [[bbox[0], bbox[1]], [bbox[2], bbox[3]]];
                    map.fitBounds(bounds, {linear: true, maxZoom: 17}, {'mapbeat': true});
                    $('.info').removeClass('hidden');
                    if (f.properties['place_name']) {
                        $('#description').text(f.properties['osm:user'] + ' edited the map ' + time + ' in ' + f.properties['place_name']);
                    } else {
                        $('#description').text(f.properties['osm:user'] + ' edited the map ' + time);
                    }
                    dataSource.setData(f);
                    queue.splice(0, 1);

                    if (queue.length === 0) {
                        first =  true;
                    }
                }
            }, 3000);
        }
    });

    setInterval(function () {
        if (queue.length) {

            // remove length - 50, leaving only new 50 items in the queue.
            console.log('fast forwarding');
            queue.splice(50);
        }
    }, 120000);
});