// Websocket client that connect to the stream server and render changes on a map.

var socket = io('https://mapbeat-lambda-staging.tilestream.net:443');
var queue = [];
var first = true;
mapboxgl.accessToken = 'pk.eyJ1IjoiZ2VvaGFja2VyIiwiYSI6ImFIN0hENW8ifQ.GGpH9gLyEg0PZf3NPQ7Vrg';
var map = new mapboxgl.Map({
    container: 'map', // container id
    style: 'mapbox://styles/mapbox/streets-v9', //stylesheet location
    center: [0, 0], // starting position
    zoom: 1 // starting zoom
});
var dataSource = new mapboxgl.GeoJSONSource({});

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
        if (feature.geometry && feature.geometry.type) {
            queue.push(feature);
            if (first) {
                first = false;
                $('#map').removeClass('loading');
                map.fire('moveend');
            }
        }
    });

    map.on('moveend', function () {
        setTimeout(function () {
            var f = queue[0];
            var bbox = turf.extent(f);
            var time = moment(Number(f.properties['osm:timestamp'])).fromNow();
            var bounds = [[bbox[0], bbox[1]], [bbox[2], bbox[3]]];
            map.fitBounds(bounds, {linear: true, maxZoom: 17});
            $('.info').removeClass('hidden');
            $('#description').text(f.properties['osm:user'] + ' edited the map ' + time);
            dataSource.setData(f);
            queue.splice(0, 1);
        }, 2000);
    });
});