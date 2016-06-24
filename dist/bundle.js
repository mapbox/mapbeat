(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Websocket client that connect to the stream server and render changes on a z7 tiled map.
// This script and node libraries used are built into dist/build.js using browserify and served in tiles.html.

var cover = require('tile-cover');
var socket = io('https://mapbeat-lambda-staging.tilestream.net:443');
var queue = [];
var first = true;
var params = URI.parseQuery(window.location.search);
var style = params.style || 'dark';

console.log(style);
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
console.log(colors[style]);

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
    console.log('map.style', map.style);
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
},{"tile-cover":2}],2:[function(require,module,exports){
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

},{}]},{},[1]);
