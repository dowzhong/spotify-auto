const express = require('express');
const app = express();

const { jpopID } = require('./config.js');

const jpopGenres = ['otacore', 'anime', 'anime rock', 'anime score', 'j-pop', 'j-rock', 'visual kei', 'japanese alternative rock', 'japanese indie rock', 'anime latino'];

const SpotifyWebApi = require('spotify-web-api-node');
const spotifyApi = new SpotifyWebApi({
    clientId: 'c7ae7aee8f434b83b625b086aedc6add',
    clientSecret: 'f8f86d09fe834b748a759e6e593c10c8',
    redirectUri: 'https://14b46242.ngrok.io/callback'
});

app.get('/callback', async (req, res) => {
    res.send('Sure.');
    try {
        const data = await spotifyApi.authorizationCodeGrant(req.query.code);
        spotifyApi.setAccessToken(data.body['access_token']);
        spotifyApi.setRefreshToken(data.body['refresh_token']);
        const savedTracks = await spotifyApi.getMySavedTracks({
            limit: 50,
            offset: 1
        });
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
        }).filter(song => {
            return !jPopPlaylist.find(alreadyInPlaylistSong => alreadyInPlaylistSong.track.id === song.track.id)
        });
        const moveIntoPlaylist = await spotifyApi.addTracksToPlaylist(jpopID, moveIntoJpopSongs.map(song => song.track.uri));
        console.log(moveIntoPlaylist);
    } catch (err) {
        console.error(err);
    }
});

app.listen(process.env.PORT, () => {
    console.log('Server running on port:', process.env.PORT);
    console.log(spotifyApi.createAuthorizeURL(['user-library-read', 'playlist-modify-private']));
});

async function getAllSongsInPlaylist(playlistID) {
    const info = await spotifyApi.getPlaylist(playlistID);
    return info.body.tracks.items;
}