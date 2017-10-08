/*
 currentTime: make GMT more readable
 IsJsonString: checks if a string is json
 leftDisjoin: efficient ES6 function to find difference between 2 arrays
*/
module.exports = {

  currentTime: () => {
    _time = new Date().toISOString().
    replace(/T/, ' ').    // replace T with a space
    replace(/\..+/, '');
    return _time;
  },

  IsJsonString: (str) => {
      try {
          JSON.parse(str);
      } catch (e) {
          return false;
      }
      return true;
  },

  leftDisjoin: (newArr, oldArr) => {
    var oldSet = new Set(oldArr);
    return newArr.filter(function(x) { return !oldSet.has(x); });
  },

  sendTweet: (msg) => {
    const twit = require('twit');
    const config = require('./config_twit.js');

    var T = new twit(config);
    var msg = JSON.parse(msg);
    var tweet = '';
    if (parseFloat(msg["team1_win_percentage_live"]).toFixed(4) > parseFloat(msg["team2_win_percentage_live"]).toFixed(4))
    {
      tweet = tweet + msg["team1_id"] + " are a  " + parseFloat(msg["team1_win_percentage_live"]).toFixed(4)*100 + "% favorite ";
      tweet = tweet + " over " +  msg["team2_id"] ;
    }
    else
    {
      tweet = tweet + msg["team2_id"] + " are a  " + parseFloat(msg["team2_win_percentage_live"]).toFixed(4)*100 + "% favorite ";
      tweet = tweet + " over " +  msg["team1_id"] ;
    }
    if (msg["team1_wins"] = "null" || msg["team2_wins"] == null) {
      tweet = tweet + ', score 0 to 0';
    }
    else {
      tweet = tweet + ', score ' + msg["team1_wins"];
      tweet = tweet + ' to ' + msg["team2_wins"];
    }

    tweet = tweet + '. http://***REMOVED***.com/matchups/' + msg["csgogame_id"];

    tweet = tweet.substring(0,139);

    try {
      T.post('statuses/update', { status: tweet }, function(err, data, response) {
        if (data.toString().indexOf('errors:')>0) {
          console.log(data); // probably an error
        }
        else {
          // console.log('OK');
        }
      });
    }
    catch (e) {
      console.log(e);
    }
  }

};
