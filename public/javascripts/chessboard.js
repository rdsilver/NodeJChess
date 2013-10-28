Raphael.fn.chessSquare = function(x,y,cell_size){
  var paper = this;
  var cell = paper.rect(x*cell_size,y*cell_size,cell_size,cell_size,3);
  var image = paper.image("images/pieces/blank.png", x*cell_size+cell_size*0.1, y*cell_size+cell_size*0.1, cell_size*0.8, cell_size*0.8);
  if((x+y) % 2 == 0){
    cell.attr({fill: 'white', 'stroke-width': 0}).data('color','white');
  }else{
    cell.attr({fill: '#444', 'stroke-width': 0}).data('color','#444');
  }
  
  //Labeling each cell with algebraic chess notation
  cell.data('column',String.fromCharCode(x+97));
  cell.data('row',8-y);
  cell.data('image', image);
  var c_mouseover = function(){
    cell.animate({fill: '#888'},250);
  } 
  var c_mouseout = function(){
    cell.animate({fill: cell.data('color')},250);
  }
  var c_click = function(){
    var column = cell.data('column');
    var row = cell.data('row');
  }
  
  //Add our calls
  cell.mouseover(c_mouseover).mouseout(c_mouseout).click(c_click);
  image.mouseover(c_mouseover).mouseout(c_mouseout).click(c_click);

  //Cell Methods
  cell.boardPos = function(){
    return cell.data('column')+cell.data('row');
  }

  cell.draw = function(pieceCharacter){
    cell.data('image').attr({src: 'images/pieces/'+pieceCharacter+'.png'});
  }

  return cell
}

$.fn.chessboard = function(start_fen){
  var width = this.width();
  var cell_size = width/8;
  this.height(width);         //Make the board square
  var paper = Raphael(this.get(0),width,width);
  var cells = new Array(8);
  for(var i = 0; i < 8; i++){
    cells[i] = new Array(8);
  }
  for(var x = 0; x < 8; x++){
    for(var y = 0; y < 8; y++){
      cells[x][y] = paper.chessSquare(x,y,cell_size);
    }
  }
  paper.rect(0,0,width,width,3).attr({'stroke-width': 2, stroke: '#000'});
  return cells;
}
