const display = document.getElementById('display');
const subDisplay = document.getElementById('sub-display');
const angleBadge = document.getElementById('angle-badge');
const memoryBadge = document.getElementById('memory-badge');

let lastAnswer = '';
let memory = 0;
let angle = 'DEG'; // 'DEG' or 'RAD'
let justCalculated = false;

// Helper: snap values very close to zero to eliminate floating-point roundoff
function snapZero(val) {
  if (typeof val === 'number' && Math.abs(val) < 1e-12) {
    return 0;
  }
  return val;
}

// Update the memory indicator badge in the UI
function updateMemoryBadge() {
  if (memoryBadge) {
    memoryBadge.style.display = memory !== 0 ? 'inline-block' : 'none';
  }
}

// Pure math evaluation engine with angle support
function evaluateExpression(expr, angleMode = 'DEG', prevAns = 0) {
  if (!expr || !expr.trim()) return '';

  // Replace Ans safely with parenthesis around previous answer
  let sanitized = expr.replace(/\bAns\b/g, `(${prevAns || 0})`);

  const degToRad = (x) => (x * Math.PI) / 180;
  const radToDeg = (x) => (x * 180) / Math.PI;

  // Build custom evaluation scope
  let scope = {
    pi: Math.PI,
    e: Math.E,
    Ans: prevAns || 0
  };

  if (angleMode === 'DEG') {
    scope.sin = (x) => snapZero(math.sin(degToRad(x)));
    scope.cos = (x) => snapZero(math.cos(degToRad(x)));
    scope.tan = (x) => {
      const normalized = ((x % 180) + 180) % 180;
      if (Math.abs(normalized - 90) < 1e-10) {
        throw new Error('Undefined (tan 90°)');
      }
      return snapZero(math.tan(degToRad(x)));
    };
    scope.asin = (x) => {
      if (x < -1 || x > 1) throw new Error('Domain error');
      return snapZero(radToDeg(math.asin(x)));
    };
    scope.acos = (x) => {
      if (x < -1 || x > 1) throw new Error('Domain error');
      return snapZero(radToDeg(math.acos(x)));
    };
    scope.atan = (x) => snapZero(radToDeg(math.atan(x)));
  } else {
    scope.sin = (x) => snapZero(math.sin(x));
    scope.cos = (x) => snapZero(math.cos(x));
    scope.tan = (x) => snapZero(math.tan(x));
    scope.asin = (x) => {
      if (x < -1 || x > 1) throw new Error('Domain error');
      return snapZero(math.asin(x));
    };
    scope.acos = (x) => {
      if (x < -1 || x > 1) throw new Error('Domain error');
      return snapZero(math.acos(x));
    };
    scope.atan = (x) => snapZero(math.atan(x));
  }

  let rawResult = math.evaluate(sanitized, scope);
  if (typeof rawResult === 'number') {
    rawResult = snapZero(rawResult);
    return math.format(rawResult, { precision: 12 });
  }
  return String(rawResult);
}

// Append value or operator to the display
function appendValue(val) {
  if (display.value === 'Error') {
    display.value = '0';
  }

  const isOperator = ['+', '-', '*', '/', '^', '%', '!'].includes(val);

  if (justCalculated) {
    justCalculated = false;
    if (!isOperator) {
      display.value = '';
    }
  }

  if (display.value === '0' && val !== '.' && !isOperator) {
    display.value = '';
  }

  if (val === 'EXP') {
    display.value += 'E';
    return;
  }

  if (val === '1/') {
    if (display.value && display.value !== '0') {
      display.value = `1/(${display.value})`;
    } else {
      display.value += '1/(';
    }
    return;
  }

  if (val === '10^') {
    display.value += '10^';
    return;
  }

  display.value += val;
}

function clearDisplay() {
  display.value = '0';
  if (subDisplay) subDisplay.textContent = '';
  justCalculated = false;
}

function deleteChar() {
  if (display.value === 'Error' || justCalculated) {
    clearDisplay();
    return;
  }
  display.value = display.value.slice(0, -1);
  if (!display.value) {
    display.value = '0';
  }
}

function calculate() {
  const expr = display.value.trim();
  if (!expr) return;

  try {
    const result = evaluateExpression(expr, angle, lastAnswer);
    if (subDisplay) {
      subDisplay.textContent = `${expr} =`;
    }
    lastAnswer = result;
    display.value = result;
    justCalculated = true;
  } catch (err) {
    if (subDisplay) {
      subDisplay.textContent = `${expr} =`;
    }
    display.value = 'Error';
    justCalculated = true;
  }
}

// Memory operations
function handleFn(fn) {
  if (fn === 'MC') {
    memory = 0;
    updateMemoryBadge();
  } else if (fn === 'MR') {
    if (display.value === '0' || justCalculated) {
      display.value = String(memory);
      justCalculated = false;
    } else {
      display.value += String(memory);
    }
  } else if (fn === 'M+' || fn === 'M-') {
    try {
      const currentVal = evaluateExpression(display.value, angle, lastAnswer);
      const num = parseFloat(currentVal);
      if (!isNaN(num)) {
        if (fn === 'M+') memory += num;
        else memory -= num;
        memory = snapZero(memory);
        updateMemoryBadge();
      }
    } catch {
      // Ignore if expression cannot be evaluated
    }
  } else if (fn === 'Ans') {
    appendValue('Ans');
  }
}

// Angle mode switch (DEG <-> RAD)
function angleMode() {
  angle = angle === 'DEG' ? 'RAD' : 'DEG';
  if (angleBadge) {
    angleBadge.textContent = angle;
  }
}

// Trig button helper
function handleTrig(fn) {
  appendValue(fn + '(');
}

// Random number insert (4 decimal places)
function randomNumber() {
  const rand = snapZero(Math.random());
  appendValue(rand.toFixed(4));
}

// Global Keyboard Support
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && !e.target.disabled) return;

  if ((e.key >= '0' && e.key <= '9') || ['+', '-', '*', '/', '.', '(', ')', '^', 'E', 'e', '%', '!'].includes(e.key)) {
    appendValue(e.key);
    e.preventDefault();
  } else if (e.key === 'Enter' || e.key === '=') {
    calculate();
    e.preventDefault();
  } else if (e.key === 'Backspace') {
    deleteChar();
    e.preventDefault();
  } else if (e.key.toLowerCase() === 'c' || e.key === 'Escape') {
    clearDisplay();
    e.preventDefault();
  }
});
