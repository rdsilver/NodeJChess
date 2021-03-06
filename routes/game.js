var mongoose    = require('mongoose'),
    User = require('../models/User'),
    Game = require('../models/Game'),
    chess = require('chess.js').Chess();

var form_helpers = require('../helpers/form_helpers.js');
var chess_helpers = require('../helpers/chess_helpers.js');

function check_game_name(game_name)
{
  var return_string = "good";

  if(!form_helpers.length_between(game_name,1,12))
  {
    return_string = "bad_length";
  }

  if(form_helpers.contains_bad_word(game_name))
  {
    return_string = "bad_word";
  }

  return return_string;
}

function check_message(message)
{
  var return_string = "good";

  if(!form_helpers.length_between(message,1,255))
  {
    return_string = "bad_length";
  }

  if(form_helpers.contains_bad_word(message))
  {
    return_string = "bad_word";
  }

  return return_string;
}

//Creating a new game
exports.create_game = function(req, res) {
  var post = req.body;
  var game = new Game({name: post.name});
  var check_string = check_game_name(game.name);


  switch(check_string) //Checks for length and no bad names in room names.
  {
    case "good": //No errors
      var white, black;
      if (post.player == "w"){ //player is joining as white
        game.white = res.locals.current_user._id;
        white = res.locals.current_user;
      }
      if (post.player == "b"){ //player is joining as black
        game.black = res.locals.current_user._id;
        black = res.locals.current_user;
      }
      //Default to a regular game
      switch(post.mode){
        case '960':
          var c960 = chess_helpers.chess960row();
          game.fen = c960+'/pppppppp/8/8/8/8/PPPPPPPP/'+c960.toUpperCase()+' w KQkq - 0 1';
          break;
        case 'ai':
          game.ai_url = post.ai_url;
        default:
          game.fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
          break;
      }
      game.game_type = post.mode;
      if(post.mode !== 'ai'){
        game.save(function (err, g) {
          if (err)
            res.json({error: 'An error has occurred' });
          else {
            res.json({redirect: '/games/'+g._id});
          }
        });
        app.render('game_row',{game: game, white: white, black: black},function(err,html){
          io.sockets.emit('create', {row: html, name: game.name});
        });
        break;
      }else{
        //Send the start pos, check for a valid response
        request('http://'+post.ai_url+'?fen=rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', function (error, response, body) {
          if (!error && response.statusCode == 200 && body.length == 4) {
            game.save(function (err, g) {
              if (err){
                res.json({error: 'An error has occurred' });
              }
              else {
                res.json({redirect: '/games/'+g._id});
              }
            });
            app.render('game_row',{game: game, white: white, black: black},function(err,html){
              io.sockets.emit('create', {row: html, name: game.name});
            });
          }else{
              res.json({error: 'Invalid AI' });
          }
        });
      }
      break;
    case "bad_length":
      res.json({error: "Game name must be between 1 and 12 characters."});
      break;
    case "bad_word":
      res.json({error: "This site is family friendly, please change game name!"});
      break;
  }
};

//Game view
exports.show = function(req, res) {
  Game.findById(req.params.id).populate('white').populate('black').exec(function(err, g) {
    res.locals.game = g;
    res.render('game', { title: 'NodeChess - Game' });
  });
};

//Join game
exports.join = function(req,res) {
  var post = req.body;
  Game.findById(req.params.id).populate('white').populate('black').exec(function(err, game) {
    var is_ai = game.game_type === 'ai';
    if (post.color == "w" && !game.white && !game.completed && !is_ai)
      game.white = res.locals.current_user._id;
    if (post.color == "b" && !game.black && !game.completed && !is_ai)
      game.black = res.locals.current_user._id;
      game.save(function(err, g) {
      if (err){
        res.json({error: 'An error has occurred'});
        return;
      }
      else if(is_ai){
        res.json({error: 'This is versus an AI opponent.'});
        return;
      }
      else{
        res.json({redirect: '/games/'+g._id});
      }
    });
  });
  io.sockets.emit(req.params.id+'/join', {color: post.color, name: res.locals.current_user.name, id: req.params.id});
}

exports.leave = function(req, res) {
  Game.findById(req.params.id).populate('white').populate('black').exec(function(err, game) {
    if (game.white && res.locals.current_user.id == game.white._id && !game.completed)
      game.white = undefined;
    if (game.black && res.locals.current_user.id == game.black._id && !game.completed)
      game.black = undefined;
    game.save(function(err, g) {
      if (err)
        res.json({error: 'An error has occurred'});
      else {
        res.json({redirect: '/games/'+g._id})
      }
    });
  });
}

exports.move = function(req,res) {
  var post = req.body;
  Game.findById(req.params.id).populate('white').populate('black').exec(function(err, game) {
    //Make sure nobody is trying anything sneaky
    var is_ai = game.game_type === 'ai';
    if((post.move.color == 'b' && res.locals.current_user.id == game.black.id) || (post.move.color == 'w' && res.locals.current_user.id == game.white.id)){
      game.past_fen.push(game.fen);
      game.fen = post.fen;
      var mate = checkCheck(game);
      switch(mate){
        case 'Checkmate':
          game.completed = true;
          if(!is_ai){
            if(game.fen.split(' ')[1] == 'b'){ //White won
                var winner = game.white;
                var loser = game.black;
            }else{ //Black won
              var loser = game.white;
              var winner = game.black;
            }
            var expected_score = 1 / (1 + Math.pow(10,(winner.elo_rating - loser.elo_rating)/400));
            winner.games_played += 1;
            loser.games_played += 1;
            winner.wins += 1;
            loser.losses += 1;
            winner.elo_rating = winner.elo_rating + Math.round(15 * (1 - expected_score));
            loser.elo_rating = loser.elo_rating + Math.round(15 * (0 - expected_score));
            winner.save();
            loser.save();
          }
          break;
        case 'Stalemate':
          game.completed = true;
          if(!is_ai){
            var white = game.white;
            var black = game.black;
            white.games_played += 1;
            black.games_played += 1;
            white.save();
            black.save();
          }
          break;
        case 'Draw':
          game.completed = true;
          if(!is_ai){
            var white = game.white;
            var black = game.black;
            white.games_played += 1;
            black.games_played += 1;
            white.save();
            black.save();
          }
          break;
      }
      game.save(function(err, g) {
        if (err){
          res.send(500);
          return;
        }else{
          if(is_ai && mate !== 'Checkmate'){
            request('http://'+g.ai_url+'?fen='+game.fen, function (error, response, body) {
              if (!error && response.statusCode == 200) {
                var from = body.substring(0,2);
                var to = body.substring(2,4);
                var promotion = body.substring(4);
                if(body.length == 5){
                  var move = chess.move({from: from, to: to, promotion: promotion});
                }else{
                  var move = chess.move({from: from, to: to});
                }
                g.past_fen.push(g.fen);
                g.fen = chess.fen();
                mate = checkCheck(g);
                switch(mate){
                  case 'Checkmate':
                    g.completed = true;
                    if(!is_ai){
                      if(g.fen.split(' ')[1] == 'b'){ //White won
                          var winner = game.white;
                          var loser = game.black;
                      }else{ //Black won
                        var loser = game.white;
                        var winner = game.black;
                      }
                      var expected_score = 1 / (1 + Math.pow(10,(winner.elo_rating - loser.elo_rating)/400));
                      winner.games_played += 1;
                      loser.games_played += 1;
                      winner.wins += 1;
                      loser.losses += 1;
                      winner.elo_rating = winner.elo_rating + Math.round(15 * (1 - expected_score));
                      loser.elo_rating = loser.elo_rating + Math.round(15 * (0 - expected_score));
                      winner.save();
                      loser.save();
                    }
                    break;
                  case 'Stalemate':
                    game.completed = true;
                    if(!is_ai){
                      var white = game.white;
                      var black = game.black;
                      white.games_played += 1;
                      black.games_played += 1;
                      white.save();
                      black.save();
                    }
                    break;
                  case 'Draw':
                    game.completed = true;
                    if(!is_ai){
                      var white = game.white;
                      var black = game.black;
                      white.games_played += 1;
                      black.games_played += 1;
                      white.save();
                      black.save();
                    }
                    break;
                }
                g.save();
                io.sockets.emit(req.params.id+'/move', {fen: g.fen, move: move, checkStatus: mate});
              }
            });
          }
          io.sockets.emit(req.params.id+'/move', {fen: post.fen, move: post.move, checkStatus: mate});
          res.send(200);
          return;
        }
      });
    }
  });
}

exports.info = function(req, res) {
  Game.findById(req.params.id).populate('white').populate('black').exec(function(err, g) {
    var player_color = [];
    if(g.white && g.white._id.toHexString() === res.locals.current_user._id.toHexString()){
      player_color.push('w');
    }
    if(g.black && g.black._id.toHexString() === res.locals.current_user._id.toHexString()){
      player_color.push('b');
    }
    else{
      player_color.push('s');
    }
    res.json({player_color: player_color, fen: g.fen, env: app.get('env')});
  });
}

//
exports.super_spectator = function(req,res) {
  res.render('super_spectator', {title: 'NodeChess'});
};

/* ELO Calculations
Rn = Ro + C * (S - Se)      (1)
where:
Rn = new rating 
Ro = old rating 
S  = score  
Se = expected score 
C  = constant 
*/


exports.check = function(req, res) {
  Game.findById(req.params.id).populate('white').populate('black').exec(function(err, game) {
    res.json({checkStatus: checkCheck(game)});
  });
}

exports.board = function(req, res) {
  Game.findById(req.params.id).populate('white').populate('black').exec(function(err, game) {
    res.render('game_board',{game: game});
  });
};

exports.game_list = function(req, res) {
  var exclude = req.body.exclude || [];
  Game.find({completed: false}).where('_id').nin(exclude).populate('white').populate('black').sort('name').limit(100).exec(function(err, games) {
    res.render('game_list',{games: games});
  });
};

exports.message = function (req, res) {
  var check_string = check_message(req.body.message);

  switch(check_string)
  {
    case "good":
      io.sockets.emit('games/'+req.params.id+"/message", {name: res.locals.current_user.name, message: req.body.message, chat: req.params.id});
      res.json({});
      return;
    case "bad_length":
      res.json({error: "Message is too long! 255 charactes MAX."});
      return;
    case "bad_word":
      res.json({error: "This site is family friendly, please don't curse"});
      return;
  }
};

exports.request_move = function (req, res){
  Game.findById(req.params.id).populate('white').populate('black').exec(function(err, game) {
    var mate = checkCheck(game);
    var is_ai = game.game_type === 'ai';
    if(is_ai && mate !== 'Checkmate' && game.fen.split(' ')[1] == 'b'){
      request('http://'+game.ai_url+'?fen='+game.fen, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          var from = body.substring(0,2);
          var to = body.substring(2,4);
          var promotion = body.substring(4);
          if(body.length == 5){
            var move = chess.move({from: from, to: to, promotion: promotion});
          }else{
            var move = chess.move({from: from, to: to});
          }
          g.past_fen.push(g.fen);
          g.fen = chess.fen();
          g.save();
          io.sockets.emit(req.params.id+'/move', {fen: g.fen, move: checkCheck(g)});
        }
      });
    }
  });
}

function checkCheck(game){
  chess.load(game.fen);
  var stat = '';
  if(chess.in_checkmate()){
    stat = 'Checkmate';
  }else if(chess.in_draw()){
    stat = 'Draw';
  }else if(chess.in_stalemate()){
    stat = 'Stalemate';
  }else if(chess.in_check()){
    stat = 'Check';
  }
  return stat;
}
