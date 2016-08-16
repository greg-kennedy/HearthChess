'use strict';

//////////////////////
// CONSTANTS
var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");

var cardWidth = 269;
var cardHeight = 376;

var manaCost = { pawn: 1, bishop: 3, rook: 3, knight: 4, queen: 7 };

//////////////////////
// GLOBALS
// display
var drawfunc = null;
var scalefactor = 1;

var mouseIsDown = false;

/// Gameplay
var deck_b = ["b_pawn","b_pawn","b_pawn","b_pawn","b_pawn","b_pawn","b_pawn","b_pawn","b_rook","b_rook","b_knight","b_knight","b_bishop","b_bishop","b_queen"];
var deck_w = ["w_pawn","w_pawn","w_pawn","w_pawn","w_pawn","w_pawn","w_pawn","w_pawn","w_rook","w_rook","w_knight","w_knight","w_bishop","w_bishop","w_queen"];
var hand_b = [];
var hand_w = [];
var board_b = [];
var board_w = [];
var maxmana_b = 0;
var maxmana_w = 0;
var mana_b = 0;
var mana_w = 0;

// The rest of these probably shouldn't be globals, but oh well
var animTimer;
var mulligan = [0,0,0];
var preMullHand;

var cardDetail = null;
var cardDetailX;
var cardDetailY;

var arrowSource;
var arrowStartX;
var arrowStartY;
var arrowEndX;
var arrowEndY;

/////////////////////////////////////////////////////
// Resource container object
var resources = {
  items: {},
  loaded: 0,
  total: 0,

  loadCallback: function () {
    var resObj = this.resObj;
    resObj.loaded++;
    if (resObj.total == resObj.loaded) {
      // What to do when all objects are loaded
      setState("mulligan");
    }
  },

  addImage: function (name) {
    var img = new Image();
    img.resObj = this;
    img.onload = this.loadCallback;
    img.url = 'img/' + name + '.png';
    this.items[name] = img;

    this.total ++;
  },
  
  load: function () {
    for (var item in this.items) {
      if (this.items.hasOwnProperty(item) && this.items[item].src === "") {
        // trigger load by setting src
        this.items[item].src = this.items[item].url;
      }
    }
  }
};

// Deck manipulation
function drawCard(deck) {
  if (deck.length === 0) return null;

  var index = Math.floor(Math.random() * deck.length);
  var card = deck[index];
  deck.splice(index,1);
  return card;
}

// Window resize stuff
window.onload = window.onresize = function() {
  // Resize canvas to 4:3 aspect within window
  if (window.innerWidth / window.innerHeight > 4/3) {
    canvas.height = window.innerHeight;
    canvas.width = Math.floor(window.innerHeight * 4 / 3);
	canvas.style.top = "0px";
	canvas.style.left = Math.floor((window.innerWidth - canvas.width) / 2) + "px";
  } else {
    canvas.width = window.innerWidth;
    canvas.height = Math.floor(window.innerWidth * 3 / 4);
	canvas.style.left = "0px";
	canvas.style.top = Math.floor((window.innerHeight - canvas.height) / 2) + "px";
  }

  // reset canvas scale
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  scalefactor = (canvas.height / 1080);
  ctx.scale(scalefactor,scalefactor);

  // redraw screen if needed
  if (drawfunc !== null)
    requestAnimationFrame(drawfunc);
};

// Helper function: determines click-in-image
function checkBounds(mX, mY, iX, iY, img) {
  if (img === null) return false;
  return (mX >= iX && mX <= iX + img.width &&
    mY >= iY && mY <= iY + img.height);
}

/////// MULLIGAN STATE
function drawMulligan() {
  // clear canvas first
  ctx.clearRect(0, 0, 1440,1080);

  // draw board, darkened
  ctx.globalAlpha = 0.5;
  ctx.drawImage(resources.items.board,0,0);
  ctx.globalAlpha = 1;

  // draw my hand, add mulligan X if needed
  ctx.drawImage(resources.items[hand_w[0]],220,340);
  if (mulligan[0]) { ctx.drawImage(resources.items.discard,260,400); }
  ctx.drawImage(resources.items[hand_w[1]],560,340);
  if (mulligan[1]) { ctx.drawImage(resources.items.discard,600,400); }
  ctx.drawImage(resources.items[hand_w[2]],900,340);
  if (mulligan[2]) { ctx.drawImage(resources.items.discard,940,400); }

  // confirm button
  ctx.drawImage(resources.items.confirm,600,800);
}

function clickMulligan(event) {
  var x = event.offsetX / scalefactor;
  var y = event.offsetY / scalefactor;

  if (checkBounds(x,y,260,400,resources.items[hand_w[0]])) {
    requestAnimationFrame(drawfunc);
    mulligan[0] = !mulligan[0];
  } else if (checkBounds(x,y,600,400,resources.items[hand_w[1]])) {
    requestAnimationFrame(drawfunc);
    mulligan[1] = !mulligan[1];
  } else if (checkBounds(x,y,940,400,resources.items[hand_w[2]])) {
    mulligan[2] = !mulligan[2];
    requestAnimationFrame(drawfunc);
  } else if (checkBounds(x,y,600,800,resources.items.confirm)) {
    // Do the mulligan: back up existing hand
    preMullHand = hand_w.slice();
	// Put back mulliganed cards
	for (var i=0; i<3; i++)
	{
	  if (mulligan[i]) {
	    deck_w.push(hand_w[i]);
	  }
	}
	// Draw replacement cards
	for (var i=0; i<3; i++)
	{
	  if (mulligan[i]) {
	    hand_w[i] = drawCard(deck_w);
	  }
	}
    setState("mulligan_anim");
  }
}

// animate cards entering hand
function drawMulliganAnim() {
  // compute time offset
  var timeOffset = Date.now() - animTimer;

  // check if this animation cycle has completed
  if (timeOffset >= 4000)
  {
    setState("main");
  } else {
    // animations should redraw continually
    requestAnimationFrame(drawMulliganAnim);

    // clear canvas first
    ctx.clearRect(0, 0, 1440,1080);

    // all modes: draw board
    // draw board, darkened
    ctx.globalAlpha = Math.max(0.5, Math.min(1, (timeOffset / 4000)));
    ctx.drawImage(resources.items.board,0,0);
    ctx.globalAlpha = 1;

    // figure out what to draw based on timeOffset
    if (timeOffset < 1000)
    {
      // mulliganed cards flipping over
      var scale = cardWidth * Math.max((1000 - timeOffset) / 1000,0);
	  for (var i = 0; i < 3; i ++) {
        // draw cards from pre-mulled hand
	    if (mulligan[i]) {
          ctx.drawImage(resources.items[preMullHand[i]],220 + (cardWidth - scale) / 2 + 340 * i,340, scale, cardHeight);
	    } else {
          ctx.drawImage(resources.items[preMullHand[i]],220 + 340 * i,340);
	    }
	  }
    } else if (timeOffset < 2000) {
      // new cards flipping up
      var scale = cardWidth * Math.min((timeOffset - 1000) / 1000,1);
	  for (var i = 0; i < 3; i ++) {
        // card scale
	    if (mulligan[i]) {
          ctx.drawImage(resources.items[hand_w[i]],220 + (cardWidth - scale) / 2 + 340 * i,340, scale, cardHeight);
	    } else {
          ctx.drawImage(resources.items[hand_w[i]],220 + 340 * i,340);
	    }
	  }
    } else if (timeOffset < 3000) {
      ctx.drawImage(resources.items[hand_w[0]],220,340);
      ctx.drawImage(resources.items[hand_w[1]],560,340);
      ctx.drawImage(resources.items[hand_w[2]],900,340);
    } else {
      var scale = Math.min((timeOffset - 3000) / 1000,1);
	  var yPos = 340 + (scale * (930 - 340));
      var spacing = Math.floor(500 / (hand_w.length + 1));
      // cards flying to hand
	  for (var i = 0; i < 3; i ++) {
	    // card X position
	    var startX = 220 + 340 * i;
        ctx.drawImage(resources.items[hand_w[i]],startX + scale * (400 + spacing*i - startX), yPos);
	  }
    }
  }
}

// MAIN - stuff that happens on your turn
function mousedownMain(event) {
  // determine item mousedowned on
  // Unscale coords
  var x = event.offsetX / scalefactor;
  var y = event.offsetY / scalefactor;

  // Check mouse inside detailCard bounds, and enough room on board to play a minion
  if (checkBounds(x,y,cardDetailX,cardDetailY,cardDetail) && board_w.length < 7) {
    // Ok start an arrow here
	arrowStartX = cardDetailX + (cardDetail.width / 2);
	arrowStartY = cardDetailY + (cardDetail.height / 2);	
	arrowEndX = x;
	arrowEndY = y;

    arrowSource = "hand";

	mouseIsDown = true;

    requestAnimationFrame(drawMain);
  } else if (Math.pow(x - 880,2) + Math.pow(y - 824,2) < 5329) {
    // Mouse down within hero power
	arrowStartX = 880;
	arrowStartY = 824;
	arrowEndX = x;
	arrowEndY = y;

    arrowSource = "power";

	mouseIsDown = true;

    requestAnimationFrame(drawMain);
  } else {
    // Only other source could be our minions
	
  	mouseIsDown = false;
  }

  return false;
}

function mouseupMain(event) {
  // Unscale coords
  var x = event.offsetX / scalefactor;
  var y = event.offsetY / scalefactor;

  if (mouseIsDown)
  {
	if (arrowSource == "hand") {
	  if (x > 125 && x < 1200 && y > 500 && y < 680) {
	    // Trying to play a minion to the board.
		//  Add a space to indicate where this would go.
	  }
	} else if (arrowSource == "power") {
	  // From the hero power
	} else if (arrowSource == "minion") {
	  // From one of our minions on board
	}
  }

  mouseIsDown = false;
  requestAnimationFrame(drawMain);
}

function mousemoveMain(event) {
  // Unscale coords
  var x = event.offsetX / scalefactor;
  var y = event.offsetY / scalefactor;

  // Arrow updates
  if (mouseIsDown)
  {
    // Mouse moved while mouse held down.
    requestAnimationFrame(drawMain);
	
	// Update arrow endpoints
    arrowEndX = x;
	arrowEndY = y;

    // Playing a card from the hand
	if (arrowSource == "hand") {
	  if (x > 125 && x < 1200 && y > 500 && y < 680 && board_w.length > 0) {
	    // Trying to play a minion to the board.
		//  We should add a space to hold this item.
		
	  }
	}
	
	return false;
  }

  // Check mouse inside detailCard bounds
  if (checkBounds(x,y,cardDetailX,cardDetailY,cardDetail)) {
    // don't remove detailCard
    return false;
  }

  // Check mouse over cards in hand
  var spacing = Math.floor(500 / (hand_w.length + 1));
  for (var i = hand_w.length - 1; i >= 0; i--) {
    if (checkBounds(x,y,400 + spacing*i,930,resources.items[hand_w[i]])) {
	  // Add a card detail for this point
	  cardDetail = resources.items[hand_w[i]];
	  cardDetailX = 400 + spacing*i;
	  cardDetailY = 710;
      requestAnimationFrame(drawMain);
	  return false;
	}
  }

  // Not in any bound boxes, remove any card detail
  if (cardDetail !== null) {
    cardDetail = null;
    requestAnimationFrame(drawMain);
  }

  return false;
}

function drawMain() {
  // draw board
  ctx.drawImage(resources.items.board,0,0);

  // draw opponent's hand
  var spacing = Math.floor(300 / (hand_b.length + 1));
  for (var i = 0; i < hand_b.length; i++) {
    ctx.drawImage(resources.items.back,450 + spacing*i,-280);
  }

  // draw my hand
  spacing = Math.floor(500 / (hand_w.length + 1));
  for (i = 0; i < hand_w.length; i++) {
    ctx.drawImage(resources.items[hand_w[i]],400 + spacing*i,930);
  }

  // card detail
  if (cardDetail !== null) {
    ctx.drawImage(cardDetail, cardDetailX, cardDetailY);
  }

  // arrow
  if (mouseIsDown)
  {
    // compute arrow scale
    ctx.save();
	ctx.translate(arrowStartX, arrowStartY);
	ctx.rotate(Math.atan2(arrowEndY - arrowStartY, arrowEndX - arrowStartX));
	ctx.translate(0, -resources.items.arrow.height / 2);
	ctx.scale(Math.sqrt(Math.pow(arrowEndY - arrowStartY,2) + Math.pow(arrowEndX - arrowStartX,2)) / (resources.items.arrow.width), 1);

    ctx.drawImage(resources.items.arrow,0,0);
	ctx.restore();
  }
}

/////// State-switching function, does things like set
// animation frame, onClick handlers, etc
function setState(state) {
  if (state == "mulligan")
  {
    canvas.onclick = clickMulligan;
	drawfunc = drawMulligan;
  } else if (state == "mulligan_anim") {
    // remove click handler
    canvas.onclick = null;
	// clock time
	animTimer = Date.now();
	drawfunc = drawMulliganAnim;
  } else {
    // Register mouse-up, -down, and -move handlers
	canvas.onmousedown = mousedownMain;
	canvas.onmouseup = mouseupMain;
	canvas.onmousemove = mousemoveMain;
	
	drawfunc = drawMain;
  }
  requestAnimationFrame(drawfunc);
}

/////// Initializer function
function init() {
  // set starting hand
  hand_w=[drawCard(deck_w),drawCard(deck_w),drawCard(deck_w)];
  hand_b=[drawCard(deck_b),drawCard(deck_b),drawCard(deck_b),drawCard(deck_b),"coin"];

  // ui elements
  resources.addImage("board");
  resources.addImage("discard");
  resources.addImage("confirm");
  resources.addImage("arrow");
  resources.addImage("mana_empty");
  resources.addImage("mana_full");
  // minion tokens
  resources.addImage("w_m_queen");
  resources.addImage("w_m_rook");
  resources.addImage("w_m_knight");
  resources.addImage("w_m_bishop");
  resources.addImage("w_m_pawn");
  resources.addImage("b_m_queen");
  resources.addImage("b_m_rook");
  resources.addImage("b_m_knight");
  resources.addImage("b_m_bishop");
  resources.addImage("b_m_pawn");
  // add card images
  resources.addImage("back");
  resources.addImage("coin");
  resources.addImage("w_queen");
  resources.addImage("w_rook");
  resources.addImage("w_knight");
  resources.addImage("w_bishop");
  resources.addImage("w_pawn");
  resources.addImage("b_queen");
  resources.addImage("b_rook");
  resources.addImage("b_knight");
  resources.addImage("b_bishop");
  resources.addImage("b_pawn");

  // Start load of objects
  resources.load();
}

init();