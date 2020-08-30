const express = require('express');
const app = express();

const { jpopID } = require('./config.js');

const jpopGenres = [
    'otacore',
    'anime',
    'anime rock',
    'anime score',
    'j-pop', 'j-rock',
    'visual kei',
    'japanese alternative rock',
    'japanese indie rock',
    'anime latino'
];

let curatingTimeout;

const SpotifyWebApi = require('spotify-web-api-node');
const spotifyApi = new SpotifyWebApi({
    clientId: process.env.ID,
    clientSecret: process.env.SECRET,
    redirectUri: 'https://spotify-auto.weeb.tools/callback'
});

app.get('/callback', async (req, res) => {
    res.send('Sure.');
    try {
        const data = await spotifyApi.authorizationCodeGrant(req.query.code);
        spotifyApi.setAccessToken(data.body['access_token']);
        spotifyApi.setRefreshToken(data.body['refresh_token']);
        clearTimeout(curatingTimeout);
        curate();
    } catch (err) {
        console.error(err);
    }
});

app.listen(process.env.PORT, () => {
    console.log('Server running on port:', process.env.PORT);
    console.log(spotifyApi.createAuthorizeURL(['user-library-read', 'playlist-modify-private', 'playlist-modify-public']));
});

async function curate() {
    try {
        await refreshToken();
        const savedTracks = await spotifyApi.getMySavedTracks({ limit: 50 });
        const songs = savedTracks.body.items;
        const allArtists = [...new Set(songs.map(song => song.track.artists.map(artist => artist.id)).flat())];
        const [info, jPopPlaylist] = await Promise.all([
            spotifyApi.getArtists(allArtists),
            getAllSongsInPlaylist(jpopID)
        ]);
        const allArtistsInfo = info.body.artists;
        const moveIntoJpopSongs = songs.filter(song => {
            return song.track.artists.some(artist => {
                const artistInfo = allArtistsInfo.find(artistInfo => artistInfo.id === artist.id);
                if (!artistInfo) { return false; }
                return artistInfo.genres.some(genre => jpopGenres.includes(genre.toLowerCase()));
            });
        }).filter(song => !jPopPlaylist.find(alreadyInPlaylistSong => alreadyInPlaylistSong.track.id === song.track.id || alreadyInPlaylistSong.track.name === song.track.name));
        if (moveIntoJpopSongs.length) {
            await spotifyApi.addTracksToPlaylist(jpopID, moveIntoJpopSongs.map(song => song.track.uri));
            console.log(`Moved ${moveIntoJpopSongs.length} songs into Jpop playlist.`);
        } else {
            console.log('No songs to move into Jpop playlist');
        }
    } catch (err) {
        console.error('Error curating...', err);
    }
    curatingTimeout = setTimeout(curate, 1000 * 60 * 15);
}

async function getAllSongsInPlaylist(playlistID) {
    const songs = [];
    const info = await spotifyApi.getPlaylistTracks(playlistID);
    songs.push(...info.body.items);
    const amountOfSongs = info.body.total;
    if (amountOfSongs > 100) {
        for (let i = 1; i < Math.ceil(amountOfSongs / 100); i++) {
            await sleep();
            const info = await spotifyApi.getPlaylistTracks(playlistID, {
                offset: 100 * i
            });
            songs.push(...info.body.items);
        }
    }
    return songs;
}

async function refreshToken() {
    const data = await spotifyApi.refreshAccessToken();
    spotifyApi.setAccessToken(data.body['access_token']);
}

function sleep(time = 1000) {
    return new Promise(resolve => setTimeout(resolve, time));
}