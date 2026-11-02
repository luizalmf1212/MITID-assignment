let canvas;
let spaceBackground;

let starImages = [];
let lightImages = [];

// Current screen
let screen = "start";

// Game sequences
let sequence = [];
let demoSequence = [0, 1, 2, 3];

let playerPosition = 0;
let activeStar = -1;
let level = 1;

// Timers
let sequenceStartTime = 0;
let countdownStartTime = 0;
let nextRoundTime = 0;

// Original timing for the demo and game
let flashInterval = 1000;
let lightDuration = 700;

// Arduino connection variables
let serialPort;
let serialReader;
let serialBuffer = "";
let connectButton;
let isConnecting = false;
let isReading = false;

async function setup() {
  // Create the canvas to fill the browser window
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("main");

  // Create the Arduino connection button
  connectButton = createButton("Connect Arduino");
  connectButton.position(20, 20);
  connectButton.style("z-index", "10");
  connectButton.style("padding", "10px 14px");
  connectButton.mousePressed(connectArduino);

  // Load the background image
  spaceBackground = await loadImage("assets/space.jpg");

  // Load the normal stars: blue, yellow, purple, and orange
  starImages[0] = await loadImage("assets/BlueStar.png");
  starImages[1] = await loadImage("assets/YellowStar.png");
  starImages[2] = await loadImage("assets/PurpleStar.png");
  starImages[3] = await loadImage("assets/OrangeStar.png");

  // Load the glowing stars
  lightImages[0] = await loadImage("assets/BlueLight.png");
  lightImages[1] = await loadImage("assets/YellowLight.png");
  lightImages[2] = await loadImage("assets/PurpleLight.png");
  lightImages[3] = await loadImage("assets/OrangeLight.png");
}

function windowResized() {
  // Resize the canvas when the browser window changes
  resizeCanvas(windowWidth, windowHeight);
}

// Return the star positions used in the demo and in the game
function getStarPositions() {
  return [
    { x: width * 0.15, y: height * 0.38 }, // Blue star
    { x: width * 0.65, y: height * 0.38 }, // Yellow star
    { x: width * 0.40, y: height * 0.62 }, // Purple star
    { x: width * 0.88, y: height * 0.62 }  // Orange star
  ];
}

// Calculate the game star size
function getStarSize() {
  return min(width * 0.22, height * 0.34);
}

// Draw one star centered at the given position
function drawStar(starImage, centerX, centerY, size) {
  let starWidth = size * 1.12;

  image(
    starImage,
    centerX - starWidth / 2,
    centerY - size / 2,
    starWidth,
    size
  );
}

// Draw the stars in the corners of the start and instructions screens
function drawCornerStars() {
  let size = getStarSize() * 0.55;

  drawStar(starImages[0], width * 0.10, height * 0.35, size);
  drawStar(starImages[1], width * 0.90, height * 0.35, size);
  drawStar(starImages[2], width * 0.10, height * 0.72, size);
  drawStar(starImages[3], width * 0.90, height * 0.72, size);
}

// Draw the game stars and light up one when needed
function drawGameStars(lightNumber) {
  let positions = getStarPositions();
  let size = getStarSize();

  for (let i = 0; i < 4; i++) {
    drawStar(starImages[i], positions[i].x, positions[i].y, size);

    if (lightNumber === i) {
      drawStar(lightImages[i], positions[i].x, positions[i].y, size);
    }
  }
}

// Draw the game title
function drawTitle() {
  noStroke();
  fill(255);
  textFont("Orbitron");
  textAlign(CENTER, CENTER);
  textSize(min(height * 0.10, width * 0.08));
  text("Memory Lights", width / 2, height * 0.13);
}

// Draw a rounded button
function drawButton(button, label, fontSize) {
  fill(245);
  stroke(170);
  strokeWeight(8);
  rect(button.x, button.y, button.w, button.h, 20);

  noStroke();
  fill(0);
  textFont("Orbitron");
  textAlign(CENTER, CENTER);
  textSize(fontSize);
  text(label, button.x + button.w / 2, button.y + button.h / 2);
}

// Return the Start button position and size
function getStartButton() {
  let buttonWidth = width * 0.38;
  let buttonHeight = height * 0.18;

  return {
    x: width / 2 - buttonWidth / 2,
    y: height * 0.44,
    w: buttonWidth,
    h: buttonHeight
  };
}

// Return the Next button position and size
function getNextButton() {
  let buttonWidth = width * 0.13;
  let buttonHeight = height * 0.07;
  let panelY = height * 0.25;
  let panelHeight = height * 0.62;

  return {
    x: width / 2 - buttonWidth / 2,
    y: panelY + panelHeight - buttonHeight - height * 0.04,
    w: buttonWidth,
    h: buttonHeight
  };
}

// Return the Play Again button position and size
function getPlayAgainButton() {
  let buttonWidth = width * 0.30;
  let buttonHeight = height * 0.12;

  return {
    x: width / 2 - buttonWidth / 2,
    y: height * 0.65,
    w: buttonWidth,
    h: buttonHeight
  };
}

// Check whether the mouse is inside a button
function clickedInside(button) {
  return (
    mouseX >= button.x &&
    mouseX <= button.x + button.w &&
    mouseY >= button.y &&
    mouseY <= button.y + button.h
  );
}

// Connect to the Arduino through the browser
async function connectArduino() {
  // Prevent a second connection attempt while connecting
  if (isConnecting) {
    return;
  }

  // Do not open the port again if it is already connected
  if (serialPort && serialPort.readable) {
    connectButton.html("Arduino connected");
    return;
  }

  // Check whether the browser supports Web Serial
  if (!("serial" in navigator)) {
    alert("Web Serial is not available in this browser.");
    return;
  }

  isConnecting = true;

  try {
    // Ask the user to choose the Arduino USB port
    serialPort = await navigator.serial.requestPort();

    // Open the port only if it is not already open
    if (!serialPort.readable) {
      await serialPort.open({ baudRate: 9600 });
    }

    connectButton.html("Arduino connected");

    // Start reading messages from the Arduino
    readArduinoMessages();
  } catch (error) {
    console.error("Arduino connection error:", error);
    alert("Connection failed: " + error.name + "\n" + error.message);
  } finally {
    isConnecting = false;
  }
}

// Read messages sent by the Arduino
async function readArduinoMessages() {
  // Make sure there is only one reader
  if (isReading) {
    return;
  }

  isReading = true;

  const decoder = new TextDecoderStream();
  const streamClosed = serialPort.readable.pipeTo(decoder.writable);

  // Log a message if the serial stream closes
  streamClosed.catch((error) => {
    console.log("Serial stream closed:", error.message);
  });

  serialReader = decoder.readable.getReader();

  try {
    while (true) {
      const { value, done } = await serialReader.read();

      if (done) {
        break;
      }

      // Save text until a complete line arrives
      serialBuffer += value;
      let messages = serialBuffer.split("\n");
      serialBuffer = messages.pop();

      // Process every complete message
      for (let message of messages) {
        handleArduinoMessage(message.trim());
      }
    }
  } catch (error) {
    console.error("Error reading Arduino:", error);
  } finally {
    serialReader.releaseLock();
    serialReader = null;
    isReading = false;
  }
}

// Convert the Arduino message into a star number
function handleArduinoMessage(message) {
  let color = message.trim().toUpperCase();

  // Show the message and current game screen in the browser console
  console.log("Arduino sent:", color, "| screen:", screen);

  let buttonNumber = {
    BLUE: 0,
    YELLOW: 1,
    PURPLE: 2,
    ORANGE: 3
  }[color];

  if (buttonNumber !== undefined) {
    checkPlayerChoice(buttonNumber);
  }
}

// Check whether the physical button matches the sequence
function checkPlayerChoice(chosenStar) {
  // Ignore button presses when it is not the player's turn
  if (screen !== "player") {
    return;
  }

  // End the game if the player pressed the wrong button
  if (chosenStar !== sequence[playerPosition]) {
    screen = "gameover";
    return;
  }

  // Move to the next position in the sequence
  playerPosition++;

  // Check whether the player completed the sequence
  if (playerPosition === sequence.length) {
    // Win after completing level 15
    if (level === 15) {
      screen = "won";
      return;
    }

    // Increase the level after a correct round
    level++;
    screen = "roundWon";
    nextRoundTime = millis() + 1200;
  }
}

// Increase the game speed a little every two levels
function getGameSpeed() {
  let speedIncreases = floor((level - 1) / 2);

  return {
    interval: max(600, flashInterval - speedIncreases * 50),
    glow: max(400, lightDuration - speedIncreases * 35)
  };
}

// Start showing the game sequence
function showTheSequence() {
  screen = "showing";
  sequenceStartTime = millis();
  playerPosition = 0;
  activeStar = -1;
}

// Update which star is glowing during the game sequence
function updateSequence() {
  let elapsed = millis() - sequenceStartTime;
  let speed = getGameSpeed();
  let position = floor(elapsed / speed.interval);

  // Finish the sequence and give the turn to the player
  if (position >= sequence.length) {
    screen = "player";
    activeStar = -1;
    playerPosition = 0;
    return;
  }

  // Keep the current star glowing for the chosen time
  if (elapsed % speed.interval < speed.glow) {
    activeStar = sequence[position];
  } else {
    activeStar = -1;
  }
}

// Draw the level label at the bottom center
function drawLevel() {
  let boxWidth = min(width * 0.22, 230);
  let boxHeight = min(height * 0.11, 65);
  let centerY = height * 0.88;

  fill(235);
  stroke(170);
  strokeWeight(6);
  rect(
    width / 2 - boxWidth / 2,
    centerY - boxHeight / 2,
    boxWidth,
    boxHeight,
    16
  );

  noStroke();
  fill(20);
  textFont("Orbitron");
  textAlign(CENTER, CENTER);
  textSize(min(height * 0.05, 30));
  text("Level " + level, width / 2, centerY);
}

function draw() {
  // Show the example sequence one star at a time
  if (screen === "demo") {
    let elapsed = millis() - sequenceStartTime;
    let step = floor(elapsed / flashInterval);

    // Start the countdown after the example
    if (step >= demoSequence.length) {
      screen = "countdown";
      countdownStartTime = millis();
      activeStar = -1;
    } else if (elapsed % flashInterval < lightDuration) {
      activeStar = demoSequence[step];
    } else {
      activeStar = -1;
    }
  }

  // Start the actual game after 3, 2, 1, and GO
  if (screen === "countdown") {
    let elapsed = millis() - countdownStartTime;

    if (elapsed >= 4000) {
      level = 1;
      sequence = [floor(random(4))];
      showTheSequence();
    }
  }

  // Start the next round after a correct answer
  if (screen === "roundWon" && millis() >= nextRoundTime) {
    sequence.push(floor(random(4)));
    showTheSequence();
  }

  // Update the active star while showing the game sequence
  if (screen === "showing") {
    updateSequence();
  }

  // Draw the space background
  image(spaceBackground, 0, 0, width, height);

  // Start screen
  if (screen === "start") {
    drawCornerStars();
    drawTitle();

    drawButton(getStartButton(), "START", height * 0.055);

    noStroke();
    fill(220);
    textFont("Orbitron");
    textAlign(CENTER, CENTER);
    textSize(height * 0.045);
    text(
      "Follow the Stars!\nRemember the sequence!",
      width / 2,
      height * 0.85
    );

    return;
  }

  // Instructions screen
  if (screen === "instructions") {
    drawCornerStars();
    drawTitle();

    let panelWidth = width * 0.64;
    let panelHeight = height * 0.62;
    let panelX = (width - panelWidth) / 2;
    let panelY = height * 0.25;

    fill(245);
    stroke(170);
    strokeWeight(8);
    rect(panelX, panelY, panelWidth, panelHeight, 20);

    noStroke();
    fill(0);
    textFont("Courier New");
    textAlign(CENTER, CENTER);
    textSize(height * 0.035);
    text("HOW TO PLAY", width / 2, panelY + height * 0.07);

    textAlign(LEFT, TOP);
    textSize(height * 0.028);
    textLeading(height * 0.075);
    text(
      "1. Watch the stars light up in sequence.\n" +
      "2. Remember the sequence.\n" +
      "3. Press the matching physical buttons.\n" +
      "4. A new star is added each round.\n" +
      "5. One mistake ends the game.",
      panelX + panelWidth * 0.08,
      panelY + height * 0.14,
      panelWidth * 0.84,
      panelHeight * 0.62
    );

    drawButton(getNextButton(), "NEXT", height * 0.028);
    return;
  }

  // Example sequence screen
  if (screen === "demo") {
    drawGameStars(activeStar);
    drawTitle();

    noStroke();
    fill(255);
    textFont("Orbitron");
    textAlign(CENTER, CENTER);
    textSize(height * 0.04);
    text("Watch the example!", width / 2, height * 0.90);

    return;
  }

  // Countdown screen
  if (screen === "countdown") {
    drawTitle();

    let elapsed = millis() - countdownStartTime;

    noStroke();
    fill(255);
    textFont("Orbitron");
    textAlign(CENTER, CENTER);
    textSize(height * 0.06);
    text("Are you ready?", width / 2, height * 0.42);

    textSize(height * 0.12);

    if (elapsed < 3000) {
      let count = 3 - floor(elapsed / 1000);
      text(count, width / 2, height * 0.58);
    } else {
      text("GO!", width / 2, height * 0.58);
    }

    return;
  }

  // Game screens
  if (
    screen === "showing" ||
    screen === "player" ||
    screen === "roundWon"
  ) {
    drawGameStars(activeStar);
    drawTitle();
    drawLevel();

    noStroke();
    fill(255);
    textFont("Orbitron");
    textAlign(CENTER, CENTER);
    textSize(height * 0.035);

    if (screen === "showing") {
      text("Watch the sequence!", width / 2, height * 0.23);
    }

    if (screen === "player") {
      text("Your turn: press the buttons!", width / 2, height * 0.23);
    }

    if (screen === "roundWon") {
      text("Correct!", width / 2, height * 0.23);
    }

    return;
  }

  // Victory screen
  if (screen === "won") {
    drawCornerStars();
    drawTitle();

    noStroke();
    fill(255);
    textFont("Orbitron");
    textAlign(CENTER, CENTER);

    textSize(height * 0.065);
    text("CONGRATULATIONS!", width / 2, height * 0.40);

    textSize(height * 0.04);
    text("You won Memory Game!", width / 2, height * 0.52);

    drawButton(getPlayAgainButton(), "PLAY AGAIN", height * 0.035);
    return;
  }

  // Game over screen
  if (screen === "gameover") {
    drawCornerStars();
    drawTitle();

    noStroke();
    fill(255);
    textFont("Orbitron");
    textAlign(CENTER, CENTER);

    textSize(height * 0.065);
    text("Oh no! You Lost", width / 2, height * 0.40);

    textSize(height * 0.04);
    text("But don't give up!", width / 2, height * 0.51);
    text("Try again!", width / 2, height * 0.58);

    drawButton(getPlayAgainButton(), "PLAY AGAIN", height * 0.035);
  }
}

function mousePressed() {
  // Start opens the instructions
  if (screen === "start" && clickedInside(getStartButton())) {
    screen = "instructions";
    return;
  }

  // Next starts the example
  if (screen === "instructions" && clickedInside(getNextButton())) {
    screen = "demo";
    sequenceStartTime = millis();
    activeStar = -1;
    return;
  }

  // Play Again restarts the game
  if (
    (screen === "gameover" || screen === "won") &&
    clickedInside(getPlayAgainButton())
  ) {
    level = 1;
    sequence = [floor(random(4))];
    showTheSequence();
  }
}