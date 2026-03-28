const display = document.getElementById('display');
let lastAnswer = '';
let memory = 0;
let angle = 'DEG'; // or 'RAD'
let expInputMode = false;

// For basic functions
function appendValue(val) {
  if (val === 'EXP') {
    display.value += 'E';
    expInputMode = true;
    return;
  }
  // Proper input format fixes for fraction, reciprocal, powers, 10^x, e^x
  if (val === '1/') {
    display.value += '1/(';
    return;
  }
  if (val === '10^') {
    display.value += '10^';
    return;
  }
  display.value += val;
}

function clearDisplay() {
  display.value = '';
  expInputMode = false;
}

function deleteChar() {
  display.value = display.value.slice(0, -1);
}

function calculate() {
  let expr = display.value.trim();
  if (!expr) return;
  // Handle Ans
  expr = expr.replace(/Ans/g, lastAnswer || '0');
  // Handle degree/radian for trig
  expr = expr.replace(/sin\(/g, angle === 'DEG' ? 'sin(degToRad(' : 'sin(');
  expr = expr.replace(/cos\(/g, angle === 'DEG' ? 'cos(degToRad(' : 'cos(');
  expr = expr.replace(/tan\(/g, angle === 'DEG' ? 'tan(degToRad(' : 'tan(');
  expr = expr.replace(/asin\(/g, angle === 'DEG' ? 'radToDeg(asin(' : 'asin(');
  expr = expr.replace(/acos\(/g, angle === 'DEG' ? 'radToDeg(acos(' : 'acos(');
  expr = expr.replace(/atan\(/g, angle === 'DEG' ? 'radToDeg(atan(' : 'atan(');

  // Custom conversion functions for math.js
  function degToRad(x) { return x * Math.PI / 180; }
  function radToDeg(x) { return x * 180 / Math.PI; }
  try {
    const scope = { pi: Math.PI, e: Math.E, Ans: lastAnswer, degToRad, radToDeg };
    let result = math.evaluate(expr, scope);
    lastAnswer = result;
    display.value = result;
  } catch (err) {
    display.value = 'Error';
  }
}

// Scientific memory functions
function handleFn(fn) {
  if (fn === 'MC') memory = 0;
  else if (fn === 'MR') display.value += memory;
  else if (fn === 'M+') memory += parseFloat(display.value || '0');
  else if (fn === 'M-') memory -= parseFloat(display.value || '0');
  else if (fn === 'Ans') display.value += lastAnswer;
}

// Angle mode switch
function angleMode() {
  angle = angle === 'DEG' ? 'RAD' : 'DEG';
  alert(`Angle mode: ${angle}`);
}

// Trig/grouped handler (for UI clarity)
function handleTrig(fn) {
  appendValue(fn + '(');
}

// Random number insert
function randomNumber() {
  display.value += Math.random();
}

// Keyboard support
document.addEventListener('keydown', (e) => {
  if ((e.key >= '0' && e.key <= '9') || ['+', '-', '*', '/', '.', '(', ')', '^', 'E', 'e'].includes(e.key)) {
    appendValue(e.key);
  } else if (e.key === 'Enter' || e.key === '=') {
    calculate();
    e.preventDefault();
  } else if (e.key === 'Backspace') {
    deleteChar();
  } else if (e.key.toLowerCase() === 'c') {
    clearDisplay();
  }
});
