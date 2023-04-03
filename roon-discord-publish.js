'use strict';

const RoonApi = require('node-roon-api'),
    RoonApiTransport = require('node-roon-api-transport'),
    DiscordRPC = require('discord-rpc'),
    RoonApiImage = require('node-roon-api-image'),
    fs = require('fs'),
    imgur = require('imgur-node-api'),
    SpotifyWebApi = require('spotify-web-api-node'),
    ImgurAnonymousUploader = require('imgur-anonymous-uploader');

let _core, _transport, _rpc, _image, _uploader, _spotifyApi;
let reconnectionTimer, discordConnected = false, roonConnected = false, lastSentStatus = 0;

const settings = require('./config.json');

const usedResults = {};
const MAX_CACHED_RESULTS = 3;
const recentResults = [];

function getSpotifyUrl(title, artist, album) {
    let key = title + artist + album;
    if (key === '') {
        return key;
    }
    if (usedResults.hasOwnProperty(key)) {
        //console.log("has image from cache!");
        // Return the previously calculated unique string for this input string
        return new Promise((resolve, reject) => {
            resolve(usedResults[key]);
        });
    } else {
        return fetchSpotifyUrl(title, artist, album);
    }
}

function fetchSpotifyUrl(title, artist, album) {
    return new Promise(async (resolve, reject) => {
        console.log('Search spotify for' + title + artist + album);
        try {
            _spotifyApi.searchTracks('track:' + title + ' artist:' + artist)//+' album:'+album)
                .then(async function (data) {
                    console.log('Search tracks by "' + artist + '" in the track name and "' + artist + '" in the artist name', data.body);
                    //console.log(data.body.tracks.items[0].external_urls.spotify);
                    if (data &&
                        data.body &&
                        data.body.tracks &&
                        data.body.tracks.items &&
                        data.body.tracks.items[0] &&
                        data.body.tracks.items[0].external_urls &&
                        data.body.tracks.items[0].external_urls.spotify) {
                        // All properties exist
                        let url = data.body.tracks.items[0].external_urls.spotify;
                        await addNewImageToCache(title + artist + album, url);
                        resolve(url);
                    } else {
                        await addNewImageToCache(title + artist + album, '');
                        reject("missing a property in " + data)
                    }

                }, async function (err) {
                    console.log('Something went wrong!', err);
                    await addNewImageToCache(title + artist + album, '');
                    reject(err);
                });
        } catch (err) {
            await addNewImageToCache(title + artist + album, '');
            reject(err);
        }
    });
}

/**
 * created by chat gpt 3
 * @param image_key
 * @returns {*}
 */
function getImageResponse(image_key) {
    if (image_key === '') {
        return image_key;
    }
    if (usedResults.hasOwnProperty(image_key)) {
        //console.log("has image from cache!");
        // Return the previously calculated unique string for this input string
        return new Promise((resolve, reject) => {
            resolve(usedResults[image_key]);
        });
    } else {
        return fetchImageResponse(image_key);
    }
}

async function addNewImageToCache(key, response) {
    usedResults[key] = response;

    // Add the input string to the recentResults array
    recentResults.unshift(key);

    // If the recentResults array is longer than MAX_CACHED_RESULTS, remove the oldest item
    if (recentResults.length > MAX_CACHED_RESULTS) {
        const oldestInputString = recentResults.pop();
        let recordToDelete = usedResults[oldestInputString];
        const deleteResponse = await _uploader.delete(recordToDelete.deleteHash);
        console.log(deleteResponse);
        delete usedResults[oldestInputString];
    }
}


imgur.setClientID(settings.imgur.clientId);
_uploader = new ImgurAnonymousUploader(settings.imgur.clientId);
_spotifyApi = new SpotifyWebApi({
    clientId: settings.spotify.client,
    clientSecret: settings.spotify.secret
});
_spotifyApi.clientCredentialsGrant().then(
    function (data) {
        _spotifyApi.setAccessToken(data.body['access_token']);
    },
    function (err) {
        console.log('Something went wrong when retrieving an access token', err);
    }
);

function scheduleReconnection() {
    clearTimeout(reconnectionTimer);
    reconnectionTimer = setTimeout(connectToDiscord, 5 * 1000);
}

function fetchImageResponse(image_key) {
    return new Promise((resolve, reject) => {
        console.log('Downloading image key=' + image_key);

        let options = {scale: 'fit', width: 200, height: 200};
        // wait for roon
        _image.get_image(image_key, options, function (error, content_type, image) {
            if (error === true) {
                console.log('Error:' + error);
                reject(error);
                return;
            }
            // wait for file write
            let path = image_key + '.tmp';
            fs.writeFile(path, image, async function (err) {
                if (err === true) {
                    reject(err);
                }
                console.log('Uploading image');
                // wait for imgur
                let uploadResponse = await _uploader.upload(path);
                console.log(uploadResponse);
                console.log('\\o/', uploadResponse.url);
                await addNewImageToCache(image_key, uploadResponse);
                resolve(uploadResponse.url);
                fs.rm(path, () => {
                });
            });
        });
    });
}

async function connectToDiscord() {
    console.log("Connecting to Discord...");

    if (_rpc && _rpc.transport.socket && _rpc.transport.socket.readyState === 1) {
        await _rpc.destroy();
    }

    _rpc = new DiscordRPC.Client({transport: 'ipc'});

    _rpc.on('ready', () => {
        console.log(`Authed for user: ${_rpc.user.username}`);

        discordConnected = true;
        clearTimeout(reconnectionTimer);

        if (!roonConnected) {
            console.log("Connecting to Roon...");

            if (settings.app.use_discovery) {
                roon.start_discovery();
            } else {
                roon.ws_connect({
                    host: settings.core_ip,
                    port: "9100"
                });
            }

            roonConnected = true;
        }
    });

    _rpc.transport.once('close', () => {
        console.log("Disconnected from discord...");
        discordConnected = false;

        scheduleReconnection();
    });

    // (syn): catching connection error is _not_ sufficient, exception is swallowed downstream
    try {
        // (syn): by sending `scopes`, the client constantly prompts for auth.
        // seems to work fine without it.
        await _rpc.login({clientId: settings.discord.clientId});
    } catch (e) {
        console.error(e);

        scheduleReconnection();
    }
}

function setStatusForZone(zone) {
    if (!discordConnected) return;

    if (zone.state === 'stopped') {
        setActivityStopped();
    } else if (zone.state === 'paused') {
        setActivityPaused(zone.now_playing.two_line.line1, zone.now_playing.two_line.line2, zone.display_name);
    } else if (zone.state === 'loading') {
        setActivityLoading(zone.display_name);
    } else if (zone.state === 'playing') {
        let artistImageKey = '';
        if (typeof zone.now_playing.artist_image_keys !== 'undefined' && zone.now_playing.artist_image_keys.length > 0) {
            artistImageKey = zone.now_playing.artist_image_keys[0];
        }
        setActivity(
            zone.now_playing.two_line.line1,
            zone.now_playing.two_line.line2,
            zone.now_playing.length,
            zone.now_playing.seek_position,
            zone.display_name,
            zone.now_playing.image_key,
            artistImageKey
        );

    }
}

async function setActivity(line1, line2, songLength, currentSeek, zoneName, largeImageKey, smallImageKey) {
    const startTimestamp = Math.round((new Date().getTime() / 1000) - currentSeek);
    const endTimestamp = Math.round(startTimestamp + songLength);

    // rate limit a bit...
    if (Date.now() - lastSentStatus < 1000 * 10) {
        return;
    } else {
        lastSentStatus = Date.now();
    }

    let artist = line2.substring(0, 128) + "";
    if (artist === "") {
        artist = "--";
    }
    let details = line1.substring(0, 128) + "";
    let detailsSmaller = line1.substring(0, 20) + "";
    if (details === "") {
        details = "--";
        detailsSmaller = "--";
    }
    let largePromise = getImageResponse(largeImageKey);
    let smallPromise = getImageResponse(smallImageKey);
    let spotifyPromise = getSpotifyUrl(details, artist, '');
    Promise
        .all([largePromise, smallPromise, spotifyPromise])
        .then((values) => {
            console.log("values are");
            console.log(values);
            let [largeImageResp, smallImageResp, spotifyUrl] = values;
            let activity = {
                details: details,
                state: artist,
                startTimestamp,
                endTimestamp,
                largeImageKey: largeImageResp.url, //'roon-main',
                largeImageText: `Zone: ${zoneName}`,
                smallImageKey: smallImageResp.url,
                smallImageText: artist
            };

            if(spotifyUrl!=''){
                activity.buttons = [{label: "Spotify Link for " + detailsSmaller, url: spotifyUrl}];
            }
            _rpc.setActivity(activity);
        })
        .catch((error) => {
            console.error(error.message);
        });
}

async function setActivityLoading(zoneName) {
    await _rpc.setActivity({
        details: 'Loading...',
        largeImageKey: 'roon-main',
        largeImageText: `Zone: ${zoneName}`,
        smallImageKey: 'roon-small',
        smallImageText: 'Roon',
        instance: false,
        type: 2
    });
}

async function setActivityPaused(line1, line2, zoneName) {
    _rpc.clearActivity();
}

async function setActivityStopped() {
    _rpc.clearActivity();
}

DiscordRPC.register(settings.discord.clientId);
if (settings.app.auto_shutdown) {
    setTimeout(() => {
        process.exit(0);
    }, 1000 * 60 * 30);
}

const roon = new RoonApi({
    extension_id: 'moe.tdr.roon-discord-rp',
    display_name: 'Discord Rich Presence',
    display_version: '1.1',
    publisher: 'Echo Fox',
    email: 'lgg.greg@gmail.com',
    website: 'https://boxfox.rocks',

    core_paired: core => {
        _core = core;
        _transport = _core.services.RoonApiTransport;
        _image = _core.services.RoonApiImage;
        let activeZone = null
        _transport.subscribe_zones((cmd, data) => {
            if (settings.zone_id) {
                activeZone = _transport._zones[settings.zone_id];
            }

            // We have no zone, set it to the latest "playing"
            // zone.
            if (activeZone === null) {
                for (const zoneID of Object.keys(_transport._zones)) {
                    const zone = _transport._zones[zoneID]
                    if (zone.state === 'playing') {
                        activeZone = zone
                        break
                    }
                }

                if (activeZone === null) {
                    console.warn("Failed to find an active zone")
                    return
                }

                console.log("Active zone changed:", activeZone.zone_id, activeZone.display_name)
            }

            if (cmd === 'Changed') {
                if (data.zones_removed) {
                    setActivityStopped();
                } else {
                    setStatusForZone(_transport._zones[activeZone.zone_id]);
                }
            }

            if (activeZone.state !== 'playing') {
                console.log("Active zone stopped, resetting")
                activeZone = null
            }
        });
    },

    core_unpaired: core => {
        _core = undefined;
        _transport = undefined;
        _image = undefined;
        roonConnected = false;
    }
});

roon.init_services({
    required_services: [RoonApiTransport, RoonApiImage]
});

connectToDiscord();
