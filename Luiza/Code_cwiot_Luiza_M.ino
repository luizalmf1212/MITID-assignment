// Digital pins connected to the buttons
const int buttonPins[4] = {2, 3, 4, 5};

// Text messages sent for each button
const char* buttonNames[4] = {
   "BLUE", "PURPLE", "YELLOW", "ORANGE"
};

// Store the last reading and the stable state of each button
int lastReading[4] = {HIGH, HIGH, HIGH, HIGH};
int stableState[4] = {HIGH, HIGH, HIGH, HIGH};

// Store the last time each button reading changed
unsigned long lastChangeTime[4] = {0, 0, 0, 0};

// Wait this long to avoid registering one press more than once
const unsigned long debounceDelay = 50;

void setup() {
  // Set every button pin to use the Arduino's internal pull-up resistor
  for (int i = 0; i < 4; i++) {
    pinMode(buttonPins[i], INPUT_PULLUP);
  }

  // Start serial communication with the computer
  Serial.begin(9600);
}

void loop() {
  // Check all four buttons
  for (int i = 0; i < 4; i++) {
    int reading = digitalRead(buttonPins[i]);

    // Start the debounce timer when the reading changes
    if (reading != lastReading[i]) {
      lastChangeTime[i] = millis();
      lastReading[i] = reading;
    }

    // Accept the new state after it stays stable for a short time
    if (millis() - lastChangeTime[i] > debounceDelay) {
      if (reading != stableState[i]) {
        stableState[i] = reading;

        // With INPUT_PULLUP, LOW means the button was pressed
        if (stableState[i] == LOW) {
          Serial.println(buttonNames[i]);
        }
      }
    }
  }
}