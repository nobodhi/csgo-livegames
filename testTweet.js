const twit = require('twit');
const config = require('./config.js');
const CircularJSON = require('circular-json');

var T = new twit(config);
var msg = '{"id":12522,"csgogame_id":2706,"team1_id":7155,"team2_id":8049,"hltv_game_id":2313152,"match_finished":false,"bestof":1,"team1_win_percentage":0.488,"team1_win_percentage_live":0.560252,"team2_win_percentage":0.512,"team2_win_percentage_live":0.439748,"match_status":1,"match_number":1,"map_name":"overpass","team1_score":1,"team2_score":0,"team1_oddsct":0.502,"team1_oddst":0.493,"team1_winodds":0.488,"team1_side":"T","team2_side":"CT","team1_wins":null,"team2_wins":null,"team1_winodds_live":0.560252}';
var msg = JSON.parse(msg);
var tweet = '' + msg["hltv_game_id"];
tweet = tweet + '\nt1 ' + msg["team1_id"];
tweet = tweet + '\nt2 ' + msg["team2_id"];
tweet = tweet + '\nt1wpl ' + msg["team1_win_percentage_live"];
tweet = tweet + '\nt2wpl ' + msg["team2_win_percentage_live"];
tweet = tweet + '\nms ' + msg["match_status"];
tweet = tweet + '\nmn ' + msg["match_number"];
tweet = tweet + '\nmf ' + msg["match_finished"];
tweet = tweet + '\nt1s ' + msg["team1_side"];
tweet = tweet + '\nt2s ' + msg["team2_side"];
tweet = tweet + '\nt1w ' + msg["team1_wins"];
tweet = tweet + '\nt2w ' + msg["team2_wins"];
tweet = tweet + '\nt1wol ' + msg["team1_winodds_live"];
//console.log(tweet.substring(1,140));
T.post('statuses/update', { status: tweet }, function(err, data, response) {
  console.log(CircularJSON.stringify(data)["text"]);
});
