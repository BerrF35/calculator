const display = document.getElementById('display');

function appendValue(val) {
  if (display.value.length > 20) return; // Limit length
  if (val === '%' && display.value !== '') {
    display.value += '/100';
  } else {
    display.value += val;
  }
}

function clearDisplay() {
  display.value = '';
}

function deleteChar() {
  display.value = display.value.slice(0, -1);
}

function calculate() {
  try {
    // Evaluate expression – use Function constructor for safety over eval (but still not for untrusted input!)
    const result = Function('"use strict";return (' + display.value + ')')();
    display.value = result;
  } catch (err) {
    display.value = 'Error';
  }
}

// Optional: Keyboard support
document.addEventListener('keydown', (e) => {
  if ((e.key >= '0' && e.key <= '9') || ['+', '-', '*', '/', '.'].includes(e.key)) {
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
