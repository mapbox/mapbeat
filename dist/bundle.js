(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
},{"tile-cover":2,"turf-centroid":4}],2:[function(require,module,exports){
var tilebelt = require('tilebelt');

/**
 * Given a geometry, create cells and return them in a format easily readable
 * by any software that reads GeoJSON.
 *
 * @alias geojson
 * @param {Object} geom GeoJSON geometry
 * @param {Object} limits an object with min_zoom and max_zoom properties
 * specifying the minimum and maximum level to be tiled.
 * @returns {Object} FeatureCollection of cells formatted as GeoJSON Features
 */
exports.geojson = function (geom, limits) {
    return {
        type: 'FeatureCollection',
        features: getTiles(geom, limits).map(tileToFeature)
    };
};

function tileToFeature(t) {
    return {
        type: 'Feature',
        geometry: tilebelt.tileToGeoJSON(t),
        properties: {}
    };
}

/**
 * Given a geometry, create cells and return them in their raw form,
 * as an array of cell identifiers.
 *
 * @alias tiles
 * @param {Object} geom GeoJSON geometry
 * @param {Object} limits an object with min_zoom and max_zoom properties
 * specifying the minimum and maximum level to be tiled.
 * @returns {Array<Array<number>>} An array of tiles given as [x, y, z] arrays
 */
exports.tiles = getTiles;

/**
 * Given a geometry, create cells and return them as
 * [quadkey](http://msdn.microsoft.com/en-us/library/bb259689.aspx) indexes.
 *
 * @alias indexes
 * @param {Object} geom GeoJSON geometry
 * @param {Object} limits an object with min_zoom and max_zoom properties
 * specifying the minimum and maximum level to be tiled.
 * @returns {Array<String>} An array of tiles given as quadkeys.
 */
exports.indexes = function (geom, limits) {
    return getTiles(geom, limits).map(tilebelt.tileToQuadkey);
};

function getTiles(geom, limits) {
    var i, tile,
        coords = geom.coordinates,
        maxZoom = limits.max_zoom,
        tileHash = {},
        tiles = [];

    if (geom.type === 'Point') {
        return [tilebelt.pointToTile(coords[0], coords[1], maxZoom)];

    } else if (geom.type === 'MultiPoint') {
        for (i = 0; i < coords.length; i++) {
            tile = tilebelt.pointToTile(coords[i][0], coords[i][1], maxZoom);
            tileHash[toID(tile[0], tile[1], tile[2])] = true;
        }
    } else if (geom.type === 'LineString') {
        lineCover(tileHash, coords, maxZoom);

    } else if (geom.type === 'MultiLineString') {
        for (i = 0; i < coords.length; i++) {
            lineCover(tileHash, coords[i], maxZoom);
        }
    } else if (geom.type === 'Polygon') {
        polygonCover(tileHash, tiles, coords, maxZoom);

    } else if (geom.type === 'MultiPolygon') {
        for (i = 0; i < coords.length; i++) {
            polygonCover(tileHash, tiles, coords[i], maxZoom);
        }
    } else {
        throw new Error('Geometry type not implemented');
    }

    if (limits.min_zoom !== maxZoom) {
        // sync tile hash and tile array so that both contain the same tiles
        var len = tiles.length;
        appendHashTiles(tileHash, tiles);
        for (i = 0; i < len; i++) {
            var t = tiles[i];
            tileHash[toID(t[0], t[1], t[2])] = true;
        }
        return mergeTiles(tileHash, tiles, limits);
    }

    appendHashTiles(tileHash, tiles);
    return tiles;
}

function mergeTiles(tileHash, tiles, limits) {
    var mergedTiles = [];

    for (var z = limits.max_zoom; z > limits.min_zoom; z--) {

        var parentTileHash = {};
        var parentTiles = [];

        for (var i = 0; i < tiles.length; i++) {
            var t = tiles[i];

            if (t[0] % 2 === 0 && t[1] % 2 === 0) {
                var id2 = toID(t[0] + 1, t[1], z),
                    id3 = toID(t[0], t[1] + 1, z),
                    id4 = toID(t[0] + 1, t[1] + 1, z);

                if (tileHash[id2] && tileHash[id3] && tileHash[id4]) {
                    tileHash[toID(t[0], t[1], t[2])] = false;
                    tileHash[id2] = false;
                    tileHash[id3] = false;
                    tileHash[id4] = false;

                    var parentTile = [t[0] / 2, t[1] / 2, z - 1];

                    if (z - 1 === limits.min_zoom) mergedTiles.push(parentTile);
                    else {
                        parentTileHash[toID(t[0] / 2, t[1] / 2, z - 1)] = true;
                        parentTiles.push(parentTile);
                    }
                }
            }
        }

        for (i = 0; i < tiles.length; i++) {
            t = tiles[i];
            if (tileHash[toID(t[0], t[1], t[2])]) mergedTiles.push(t);
        }

        tileHash = parentTileHash;
        tiles = parentTiles;
    }

    return mergedTiles;
}

function polygonCover(tileHash, tileArray, geom, zoom) {
    var intersections = [];

    for (var i = 0; i < geom.length; i++) {
        var ring = [];
        lineCover(tileHash, geom[i], zoom, ring);

        for (var j = 0, len = ring.length, k = len - 1; j < len; k = j++) {
            var m = (j + 1) % len;
            var y = ring[j][1];

            // add interesction if it's not local extremum or duplicate
            if ((y > ring[k][1] || y > ring[m][1]) && // not local minimum
                (y < ring[k][1] || y < ring[m][1]) && // not local maximum
                y !== ring[m][1]) intersections.push(ring[j]);
        }
    }

    intersections.sort(compareTiles); // sort by y, then x

    for (i = 0; i < intersections.length; i += 2) {
        // fill tiles between pairs of intersections
        y = intersections[i][1];
        for (var x = intersections[i][0] + 1; x < intersections[i + 1][0]; x++) {
            var id = toID(x, y, zoom);
            if (!tileHash[id]) {
                tileArray.push([x, y, zoom]);
            }
        }
    }
}

function compareTiles(a, b) {
    return (a[1] - b[1]) || (a[0] - b[0]);
}

function lineCover(tileHash, coords, maxZoom, ring) {
    var prevX, prevY;

    for (var i = 0; i < coords.length - 1; i++) {
        var start = tilebelt.pointToTileFraction(coords[i][0], coords[i][1], maxZoom),
            stop = tilebelt.pointToTileFraction(coords[i + 1][0], coords[i + 1][1], maxZoom),
            x0 = start[0],
            y0 = start[1],
            x1 = stop[0],
            y1 = stop[1],
            dx = x1 - x0,
            dy = y1 - y0;

        if (dy === 0 && dx === 0) continue;

        var sx = dx > 0 ? 1 : -1,
            sy = dy > 0 ? 1 : -1,
            x = Math.floor(x0),
            y = Math.floor(y0),
            tMaxX = dx === 0 ? Infinity : Math.abs(((dx > 0 ? 1 : 0) + x - x0) / dx),
            tMaxY = dy === 0 ? Infinity : Math.abs(((dy > 0 ? 1 : 0) + y - y0) / dy),
            tdx = Math.abs(sx / dx),
            tdy = Math.abs(sy / dy);

        if (x !== prevX || y !== prevY) {
            tileHash[toID(x, y, maxZoom)] = true;
            if (ring && y !== prevY) ring.push([x, y]);
            prevX = x;
            prevY = y;
        }

        while (tMaxX < 1 || tMaxY < 1) {
            if (tMaxX < tMaxY) {
                tMaxX += tdx;
                x += sx;
            } else {
                tMaxY += tdy;
                y += sy;
            }
            tileHash[toID(x, y, maxZoom)] = true;
            if (ring && y !== prevY) ring.push([x, y]);
            prevX = x;
            prevY = y;
        }
    }

    if (ring && y === ring[0][1]) ring.pop();
}

function appendHashTiles(hash, tiles) {
    var keys = Object.keys(hash);
    for (var i = 0; i < keys.length; i++) {
        tiles.push(fromID(+keys[i]));
    }
}

function toID(x, y, z) {
    var dim = 2 * (1 << z);
    return ((dim * y + x) * 32) + z;
}

function fromID(id) {
    var z = id % 32,
        dim = 2 * (1 << z),
        xy = ((id - z) / 32),
        x = xy % dim,
        y = ((xy - x) / dim) % dim;
    return [x, y, z];
}

},{"tilebelt":3}],3:[function(require,module,exports){
// a tile is an array [x,y,z]
var d2r = Math.PI / 180,
    r2d = 180 / Math.PI;

function tileToBBOX (tile) {
    var e = tile2lon(tile[0]+1,tile[2]);
    var w = tile2lon(tile[0],tile[2]);
    var s = tile2lat(tile[1]+1,tile[2]);
    var n = tile2lat(tile[1],tile[2]);
    return [w,s,e,n];
}

function tileToGeoJSON (tile) {
    var bbox = tileToBBOX(tile);
    var poly = {
        type: 'Polygon',
        coordinates:
            [
                [
                    [bbox[0],bbox[1]],
                    [bbox[0], bbox[3]],
                    [bbox[2], bbox[3]],
                    [bbox[2], bbox[1]],
                    [bbox[0], bbox[1]]
                ]
            ]
    };
    return poly;
}

function tile2lon(x, z) {
    return (x/Math.pow(2,z)*360-180);
}

function tile2lat(y, z) {
    var n=Math.PI-2*Math.PI*y/Math.pow(2,z);
    return (r2d*Math.atan(0.5*(Math.exp(n)-Math.exp(-n))));
}

function pointToTile(lon, lat, z) {
    var tile = pointToTileFraction(lon, lat, z);
    tile[0] = Math.floor(tile[0]);
    tile[1] = Math.floor(tile[1]);
    return tile;
}

function getChildren (tile) {
    return [
        [tile[0]*2, tile[1]*2, tile[2]+1],
        [tile[0]*2+1, tile[1]*2, tile[2 ]+1],
        [tile[0]*2+1, tile[1]*2+1, tile[2]+1],
        [tile[0]*2, tile[1]*2+1, tile[2]+1],
    ];
}

function getParent (tile) {
    // top left
    if(tile[0]%2===0 && tile[1]%2===0) {
        return [tile[0]/2, tile[1]/2, tile[2]-1];
    }
    // bottom left
    else if((tile[0]%2===0) && (!tile[1]%2===0)) {
        return [tile[0]/2, (tile[1]-1)/2, tile[2]-1];
    }
    // top right
    else if((!tile[0]%2===0) && (tile[1]%2===0)) {
        return [(tile[0]-1)/2, (tile[1])/2, tile[2]-1];
    }
    // bottom right
    else {
        return [(tile[0]-1)/2, (tile[1]-1)/2, tile[2]-1];
    }
}

function getSiblings (tile) {
    return getChildren(getParent(tile));
}

function hasSiblings(tile, tiles) {
    var siblings = getSiblings(tile);
    for (var i = 0; i < siblings.length; i++) {
        if (!hasTile(tiles, siblings[i])) return false;
    }
    return true;
}

function hasTile(tiles, tile) {
    for (var i = 0; i < tiles.length; i++) {
        if (tilesEqual(tiles[i], tile)) return true;
    }
    return false;
}

function tilesEqual(tile1, tile2) {
    return (
        tile1[0] === tile2[0] &&
        tile1[1] === tile2[1] &&
        tile1[2] === tile2[2]
    );
}

function tileToQuadkey(tile) {
  var index = '';
  for (var z = tile[2]; z > 0; z--) {
      var b = 0;
      var mask = 1 << (z - 1);
      if ((tile[0] & mask) !== 0) b++;
      if ((tile[1] & mask) !== 0) b += 2;
      index += b.toString();
  }
  return index;
}

function quadkeyToTile(quadkey) {
    var x = 0;
    var y = 0;
    var z = quadkey.length;

    for (var i = z; i > 0; i--) {
        var mask = 1 << (i - 1);
        switch (quadkey[z - i]) {
            case '0':
                break;

            case '1':
                x |= mask;
                break;

            case '2':
                y |= mask;
                break;

            case '3':
                x |= mask;
                y |= mask;
                break;
        }
    }
    return [x,y,z];
}

function bboxToTile(bboxCoords) {
    var min = pointToTile(bboxCoords[0], bboxCoords[1], 32);
    var max = pointToTile(bboxCoords[2], bboxCoords[3], 32);
    var bbox = [min[0], min[1], max[0], max[1]];

    var z = getBboxZoom(bbox);
    if (z === 0) return [0,0,0];
    var x = bbox[0] >>> (32 - z);
    var y = bbox[1] >>> (32 - z);
    return [x,y,z];
}

function getBboxZoom(bbox) {
    var MAX_ZOOM = 28;
    for (var z = 0; z < MAX_ZOOM; z++) {
        var mask = 1 << (32 - (z + 1));
        if (((bbox[0] & mask) != (bbox[2] & mask)) ||
            ((bbox[1] & mask) != (bbox[3] & mask))) {
            return z;
        }
    }

    return MAX_ZOOM;
}

function pointToTileFraction(lon, lat, z) {
    var sin = Math.sin(lat * d2r),
        z2 = Math.pow(2, z),
        x = z2 * (lon / 360 + 0.5),
        y = z2 * (0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI);
    return [x, y, z];
}

module.exports = {
    tileToGeoJSON: tileToGeoJSON,
    tileToBBOX: tileToBBOX,
    getChildren: getChildren,
    getParent: getParent,
    getSiblings: getSiblings,
    hasTile: hasTile,
    hasSiblings: hasSiblings,
    tilesEqual: tilesEqual,
    tileToQuadkey: tileToQuadkey,
    quadkeyToTile: quadkeyToTile,
    pointToTile: pointToTile,
    bboxToTile: bboxToTile,
    pointToTileFraction: pointToTileFraction
};

},{}],4:[function(require,module,exports){
var each = require('turf-meta').coordEach;
var point = require('turf-helpers').point;

/**
 * Takes one or more features and calculates the centroid using
 * the mean of all vertices.
 * This lessens the effect of small islands and artifacts when calculating
 * the centroid of a set of polygons.
 *
 * @name centroid
 * @param {(Feature|FeatureCollection)} features input features
 * @return {Feature<Point>} the centroid of the input features
 * @example
 * var poly = {
 *   "type": "Feature",
 *   "properties": {},
 *   "geometry": {
 *     "type": "Polygon",
 *     "coordinates": [[
 *       [105.818939,21.004714],
 *       [105.818939,21.061754],
 *       [105.890007,21.061754],
 *       [105.890007,21.004714],
 *       [105.818939,21.004714]
 *     ]]
 *   }
 * };
 *
 * var centroidPt = turf.centroid(poly);
 *
 * var result = {
 *   "type": "FeatureCollection",
 *   "features": [poly, centroidPt]
 * };
 *
 * //=result
 */
module.exports = function (features) {
    var xSum = 0, ySum = 0, len = 0;
    each(features, function (coord) {
        xSum += coord[0];
        ySum += coord[1];
        len++;
    }, true);
    return point([xSum / len, ySum / len]);
};

},{"turf-helpers":5,"turf-meta":6}],5:[function(require,module,exports){
/**
 * Wraps a GeoJSON {@link Geometry} in a GeoJSON {@link Feature}.
 *
 * @name feature
 * @param {Geometry} geometry input geometry
 * @returns {FeatureCollection} a FeatureCollection of input features
 * @example
 * var geometry = {
 *      "type": "Point",
 *      "coordinates": [
 *        67.5,
 *        32.84267363195431
 *      ]
 *    }
 *
 * var feature = turf.feature(geometry);
 *
 * //=feature
 */
function feature(geometry, properties) {
    return {
        type: 'Feature',
        properties: properties || {},
        geometry: geometry
    };
}

module.exports.feature = feature;

/**
 * Takes coordinates and properties (optional) and returns a new {@link Point} feature.
 *
 * @name point
 * @param {number[]} coordinates longitude, latitude position (each in decimal degrees)
 * @param {Object=} properties an Object that is used as the {@link Feature}'s
 * properties
 * @returns {Feature<Point>} a Point feature
 * @example
 * var pt1 = turf.point([-75.343, 39.984]);
 *
 * //=pt1
 */
module.exports.point = function (coordinates, properties) {
    if (!Array.isArray(coordinates)) throw new Error('Coordinates must be an array');
    if (coordinates.length < 2) throw new Error('Coordinates must be at least 2 numbers long');
    return feature({
        type: 'Point',
        coordinates: coordinates.slice()
    }, properties);
};

/**
 * Takes an array of LinearRings and optionally an {@link Object} with properties and returns a {@link Polygon} feature.
 *
 * @name polygon
 * @param {Array<Array<Array<number>>>} rings an array of LinearRings
 * @param {Object=} properties a properties object
 * @returns {Feature<Polygon>} a Polygon feature
 * @throws {Error} throw an error if a LinearRing of the polygon has too few positions
 * or if a LinearRing of the Polygon does not have matching Positions at the
 * beginning & end.
 * @example
 * var polygon = turf.polygon([[
 *  [-2.275543, 53.464547],
 *  [-2.275543, 53.489271],
 *  [-2.215118, 53.489271],
 *  [-2.215118, 53.464547],
 *  [-2.275543, 53.464547]
 * ]], { name: 'poly1', population: 400});
 *
 * //=polygon
 */
module.exports.polygon = function (coordinates, properties) {

    if (!coordinates) throw new Error('No coordinates passed');

    for (var i = 0; i < coordinates.length; i++) {
        var ring = coordinates[i];
        if (ring.length < 4) {
            throw new Error('Each LinearRing of a Polygon must have 4 or more Positions.');
        }
        for (var j = 0; j < ring[ring.length - 1].length; j++) {
            if (ring[ring.length - 1][j] !== ring[0][j]) {
                throw new Error('First and last Position are not equivalent.');
            }
        }
    }

    return feature({
        type: 'Polygon',
        coordinates: coordinates
    }, properties);
};

/**
 * Creates a {@link LineString} based on a
 * coordinate array. Properties can be added optionally.
 *
 * @name lineString
 * @param {Array<Array<number>>} coordinates an array of Positions
 * @param {Object=} properties an Object of key-value pairs to add as properties
 * @returns {Feature<LineString>} a LineString feature
 * @throws {Error} if no coordinates are passed
 * @example
 * var linestring1 = turf.lineString([
 *	[-21.964416, 64.148203],
 *	[-21.956176, 64.141316],
 *	[-21.93901, 64.135924],
 *	[-21.927337, 64.136673]
 * ]);
 * var linestring2 = turf.lineString([
 *	[-21.929054, 64.127985],
 *	[-21.912918, 64.134726],
 *	[-21.916007, 64.141016],
 * 	[-21.930084, 64.14446]
 * ], {name: 'line 1', distance: 145});
 *
 * //=linestring1
 *
 * //=linestring2
 */
module.exports.lineString = function (coordinates, properties) {
    if (!coordinates) {
        throw new Error('No coordinates passed');
    }
    return feature({
        type: 'LineString',
        coordinates: coordinates
    }, properties);
};

/**
 * Takes one or more {@link Feature|Features} and creates a {@link FeatureCollection}.
 *
 * @name featureCollection
 * @param {Feature[]} features input features
 * @returns {FeatureCollection} a FeatureCollection of input features
 * @example
 * var features = [
 *  turf.point([-75.343, 39.984], {name: 'Location A'}),
 *  turf.point([-75.833, 39.284], {name: 'Location B'}),
 *  turf.point([-75.534, 39.123], {name: 'Location C'})
 * ];
 *
 * var fc = turf.featureCollection(features);
 *
 * //=fc
 */
module.exports.featureCollection = function (features) {
    return {
        type: 'FeatureCollection',
        features: features
    };
};

/**
 * Creates a {@link Feature<MultiLineString>} based on a
 * coordinate array. Properties can be added optionally.
 *
 * @name multiLineString
 * @param {Array<Array<Array<number>>>} coordinates an array of LineStrings
 * @param {Object=} properties an Object of key-value pairs to add as properties
 * @returns {Feature<MultiLineString>} a MultiLineString feature
 * @throws {Error} if no coordinates are passed
 * @example
 * var multiLine = turf.multiLineString([[[0,0],[10,10]]]);
 *
 * //=multiLine
 *
 */
module.exports.multiLineString = function (coordinates, properties) {
    if (!coordinates) {
        throw new Error('No coordinates passed');
    }
    return feature({
        type: 'MultiLineString',
        coordinates: coordinates
    }, properties);
};

/**
 * Creates a {@link Feature<MultiPoint>} based on a
 * coordinate array. Properties can be added optionally.
 *
 * @name multiPoint
 * @param {Array<Array<number>>} coordinates an array of Positions
 * @param {Object=} properties an Object of key-value pairs to add as properties
 * @returns {Feature<MultiPoint>} a MultiPoint feature
 * @throws {Error} if no coordinates are passed
 * @example
 * var multiPt = turf.multiPoint([[0,0],[10,10]]);
 *
 * //=multiPt
 *
 */
module.exports.multiPoint = function (coordinates, properties) {
    if (!coordinates) {
        throw new Error('No coordinates passed');
    }
    return feature({
        type: 'MultiPoint',
        coordinates: coordinates
    }, properties);
};


/**
 * Creates a {@link Feature<MultiPolygon>} based on a
 * coordinate array. Properties can be added optionally.
 *
 * @name multiPolygon
 * @param {Array<Array<Array<Array<number>>>>} coordinates an array of Polygons
 * @param {Object=} properties an Object of key-value pairs to add as properties
 * @returns {Feature<MultiPolygon>} a multipolygon feature
 * @throws {Error} if no coordinates are passed
 * @example
 * var multiPoly = turf.multiPolygon([[[[0,0],[0,10],[10,10],[10,0],[0,0]]]);
 *
 * //=multiPoly
 *
 */
module.exports.multiPolygon = function (coordinates, properties) {
    if (!coordinates) {
        throw new Error('No coordinates passed');
    }
    return feature({
        type: 'MultiPolygon',
        coordinates: coordinates
    }, properties);
};

/**
 * Creates a {@link Feature<GeometryCollection>} based on a
 * coordinate array. Properties can be added optionally.
 *
 * @name geometryCollection
 * @param {Array<{Geometry}>} geometries an array of GeoJSON Geometries
 * @param {Object=} properties an Object of key-value pairs to add as properties
 * @returns {Feature<GeometryCollection>} a geometrycollection feature
 * @example
 * var pt = {
 *     "type": "Point",
 *       "coordinates": [100, 0]
 *     };
 * var line = {
 *     "type": "LineString",
 *     "coordinates": [ [101, 0], [102, 1] ]
 *   };
 * var collection = turf.geometrycollection([[0,0],[10,10]]);
 *
 * //=collection
 */
module.exports.geometryCollection = function (geometries, properties) {
    return feature({
        type: 'GeometryCollection',
        geometries: geometries
    }, properties);
};

var factors = {
    miles: 3960,
    nauticalmiles: 3441.145,
    degrees: 57.2957795,
    radians: 1,
    inches: 250905600,
    yards: 6969600,
    meters: 6373000,
    metres: 6373000,
    kilometers: 6373,
    kilometres: 6373
};

/*
 * Convert a distance measurement from radians to a more friendly unit.
 *
 * @name radiansToDistance
 * @param {number} distance in radians across the sphere
 * @param {string=kilometers} units: one of miles, nauticalmiles, degrees, radians,
 * inches, yards, metres, meters, kilometres, kilometers.
 * @returns {number} distance
 */
module.exports.radiansToDistance = function (radians, units) {
    var factor = factors[units || 'kilometers'];
    if (factor === undefined) {
        throw new Error('Invalid unit');
    }
    return radians * factor;
};

/*
 * Convert a distance measurement from a real-world unit into radians
 *
 * @name distanceToRadians
 * @param {number} distance in real units
 * @param {string=kilometers} units: one of miles, nauticalmiles, degrees, radians,
 * inches, yards, metres, meters, kilometres, kilometers.
 * @returns {number} radians
 */
module.exports.distanceToRadians = function (distance, units) {
    var factor = factors[units || 'kilometers'];
    if (factor === undefined) {
        throw new Error('Invalid unit');
    }
    return distance / factor;
};

/*
 * Convert a distance measurement from a real-world unit into degrees
 *
 * @name distanceToRadians
 * @param {number} distance in real units
 * @param {string=kilometers} units: one of miles, nauticalmiles, degrees, radians,
 * inches, yards, metres, meters, kilometres, kilometers.
 * @returns {number} degrees
 */
module.exports.distanceToDegrees = function (distance, units) {
    var factor = factors[units || 'kilometers'];
    if (factor === undefined) {
        throw new Error('Invalid unit');
    }
    return (distance / factor) * 57.2958;
};

},{}],6:[function(require,module,exports){
/**
 * Iterate over coordinates in any GeoJSON object, similar to
 * Array.forEach.
 *
 * @param {Object} layer any GeoJSON object
 * @param {Function} callback a method that takes (value)
 * @param {boolean=} excludeWrapCoord whether or not to include
 * the final coordinate of LinearRings that wraps the ring in its iteration.
 * @example
 * var point = { type: 'Point', coordinates: [0, 0] };
 * coordEach(point, function(coords) {
 *   // coords is equal to [0, 0]
 * });
 */
function coordEach(layer, callback, excludeWrapCoord) {
    var i, j, k, g, l, geometry, stopG, coords,
        geometryMaybeCollection,
        wrapShrink = 0,
        isGeometryCollection,
        isFeatureCollection = layer.type === 'FeatureCollection',
        isFeature = layer.type === 'Feature',
        stop = isFeatureCollection ? layer.features.length : 1;

  // This logic may look a little weird. The reason why it is that way
  // is because it's trying to be fast. GeoJSON supports multiple kinds
  // of objects at its root: FeatureCollection, Features, Geometries.
  // This function has the responsibility of handling all of them, and that
  // means that some of the `for` loops you see below actually just don't apply
  // to certain inputs. For instance, if you give this just a
  // Point geometry, then both loops are short-circuited and all we do
  // is gradually rename the input until it's called 'geometry'.
  //
  // This also aims to allocate as few resources as possible: just a
  // few numbers and booleans, rather than any temporary arrays as would
  // be required with the normalization approach.
    for (i = 0; i < stop; i++) {

        geometryMaybeCollection = (isFeatureCollection ? layer.features[i].geometry :
        (isFeature ? layer.geometry : layer));
        isGeometryCollection = geometryMaybeCollection.type === 'GeometryCollection';
        stopG = isGeometryCollection ? geometryMaybeCollection.geometries.length : 1;

        for (g = 0; g < stopG; g++) {
            geometry = isGeometryCollection ?
            geometryMaybeCollection.geometries[g] : geometryMaybeCollection;
            coords = geometry.coordinates;

            wrapShrink = (excludeWrapCoord &&
                (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon')) ?
                1 : 0;

            if (geometry.type === 'Point') {
                callback(coords);
            } else if (geometry.type === 'LineString' || geometry.type === 'MultiPoint') {
                for (j = 0; j < coords.length; j++) callback(coords[j]);
            } else if (geometry.type === 'Polygon' || geometry.type === 'MultiLineString') {
                for (j = 0; j < coords.length; j++)
                    for (k = 0; k < coords[j].length - wrapShrink; k++)
                        callback(coords[j][k]);
            } else if (geometry.type === 'MultiPolygon') {
                for (j = 0; j < coords.length; j++)
                    for (k = 0; k < coords[j].length; k++)
                        for (l = 0; l < coords[j][k].length - wrapShrink; l++)
                            callback(coords[j][k][l]);
            } else {
                throw new Error('Unknown Geometry Type');
            }
        }
    }
}
module.exports.coordEach = coordEach;

/**
 * Reduce coordinates in any GeoJSON object into a single value,
 * similar to how Array.reduce works. However, in this case we lazily run
 * the reduction, so an array of all coordinates is unnecessary.
 *
 * @param {Object} layer any GeoJSON object
 * @param {Function} callback a method that takes (memo, value) and returns
 * a new memo
 * @param {boolean=} excludeWrapCoord whether or not to include
 * the final coordinate of LinearRings that wraps the ring in its iteration.
 * @param {*} memo the starting value of memo: can be any type.
 */
function coordReduce(layer, callback, memo, excludeWrapCoord) {
    coordEach(layer, function (coord) {
        memo = callback(memo, coord);
    }, excludeWrapCoord);
    return memo;
}
module.exports.coordReduce = coordReduce;

/**
 * Iterate over property objects in any GeoJSON object, similar to
 * Array.forEach.
 *
 * @param {Object} layer any GeoJSON object
 * @param {Function} callback a method that takes (value)
 * @example
 * var point = { type: 'Feature', geometry: null, properties: { foo: 1 } };
 * propEach(point, function(props) {
 *   // props is equal to { foo: 1}
 * });
 */
function propEach(layer, callback) {
    var i;
    switch (layer.type) {
    case 'FeatureCollection':
        for (i = 0; i < layer.features.length; i++) {
            callback(layer.features[i].properties);
        }
        break;
    case 'Feature':
        callback(layer.properties);
        break;
    }
}
module.exports.propEach = propEach;

/**
 * Reduce properties in any GeoJSON object into a single value,
 * similar to how Array.reduce works. However, in this case we lazily run
 * the reduction, so an array of all properties is unnecessary.
 *
 * @param {Object} layer any GeoJSON object
 * @param {Function} callback a method that takes (memo, coord) and returns
 * a new memo
 * @param {*} memo the starting value of memo: can be any type.
 */
function propReduce(layer, callback, memo) {
    propEach(layer, function (prop) {
        memo = callback(memo, prop);
    });
    return memo;
}
module.exports.propReduce = propReduce;

/**
 * Iterate over features in any GeoJSON object, similar to
 * Array.forEach.
 *
 * @param {Object} layer any GeoJSON object
 * @param {Function} callback a method that takes (value)
 * @example
 * var feature = { type: 'Feature', geometry: null, properties: {} };
 * featureEach(feature, function(feature) {
 *   // feature == feature
 * });
 */
function featureEach(layer, callback) {
    if (layer.type === 'Feature') {
        return callback(layer);
    }
    if (layer.type === 'FeatureCollection') {
        for (var i = 0; i < layer.features.length; i++) {
            callback(layer.features[i]);
        }
    }
}
module.exports.featureEach = featureEach;

/**
 * Get all coordinates from any GeoJSON object, returning an array of coordinate
 * arrays.
 * @param {Object} layer any GeoJSON object
 * @return {Array<Array<Number>>} coordinate position array
 */
function coordAll(layer) {
    var coords = [];
    coordEach(layer, function (coord) {
        coords.push(coord);
    });
    return coords;
}
module.exports.coordAll = coordAll;

},{}]},{},[1]);
