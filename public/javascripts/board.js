$(function(){
  var game_board = $('.game_board');
  var receive_message = function(data){
    var name = data.name;
    var message = data.message;
    var chatbox = $("#chat_messages");
    chatbox.text(chatbox.text() + name+": "+message+"\n");
    chatbox.scrollTop(chatbox[0].scrollHeight);
  };

  if(game_board.length > 0){
    game_board.each(function(){
      var game_id = $(this).attr('id');
      new Chess(game_id,socket);
      socket.on(game_id+'/join', function(data){
        var board = $('#'+data.id);
        if(data.color == 'b'){
          board.parent().find('.black_name').text(data.name);
        }else if(data.color == 'w'){
          board.parent().find('.white_name').text(data.name);
        }
      });
      socket.on('games/'+game_id+'/message', receive_message);
    });

  }else{
    socket.on('games/lobby/message', receive_message);
  }

  $('.body').on('click','.join_game, #create_game, .login, .create_user',function(e){
    e.preventDefault();
    var form = $(this).parents('form');
    var url = form.attr('action');
    $.ajax({
      type: "POST",
      url: url,
      data: form.serialize(),
      dataType: "json",
      success: function(data) {
        if (data.redirect) {
          window.location.href = data.redirect;
        }
        else {
          $(".message").text(data.error).removeClass('hidden');
        }
      }
    }); 
  });

  $('.quit_game').click(function(e){
    e.preventDefault();
    var url = $(this).attr('href');
    $.ajax({
      type: "GET",
      url: url,
      dataType: "json",
      success: function(data) {
        if (data.redirect) {
          window.location.href = data.redirect;
        }
        else {
          $(".message").text(data.error).removeClass('hidden');
        }
      }
    }); 
  });

  $('body').on('click','.new_game',function(){
    var current = $(this);
    var next = current.parent().next().find('.board_selector');
    current.removeClass('new_game');
    current.load('/games/game_list');
    //next.removeClass('board_selector').addClass('new_game');
  });

  $('#message').submit(function(e){
    e.preventDefault();
    var game_id = $(this).find('#room').val();
    $.ajax({
      type: "POST",
      url: "/games/"+game_id+"/message",
      data: {message: $("#chat_input").val()},
      dataType: "json",
      success: function(data) {
        if(!data.error)
          $("#chat_input").val("");
        else
          $(".message").text(data.error).removeClass('hidden');
      }
    });
  });

});
