/* ==========================================================================
   ApexCalc - Frontend Engine & UI Controller
   ========================================================================== */

// DOM Elements
const display = document.getElementById('display');
const subDisplay = document.getElementById('sub-display');
const angleBadge = document.getElementById('angle-badge');
const memoryBadge = document.getElementById('memory-badge');
const calculatorCard = document.getElementById('calculator-card');
const tabBasic = document.getElementById('tab-basic');
const tabScientific = document.getElementById('tab-scientific');
const modeHint = document.getElementById('mode-hint');
const upgradeModal = document.getElementById('upgrade-modal');
const authModal = document.getElementById('auth-modal');
const authHeaderBtn = document.getElementById('auth-header-btn');
const planBadgeBtn = document.getElementById('plan-badge-btn');
const planText = document.getElementById('plan-text');
const sciLockIndicator = document.getElementById('sci-lock-indicator');
const scientificPill = document.getElementById('scientific-pill');

// Application State
let currentMode = 'basic'; // 'basic' or 'scientific'
let isPremium = false;     // Entitlement state (verified by server in Phase 8)
let currentUser = null;    // Active user session (Supabase in Phase 4)
let activeAuthTab = 'signin';
let supabaseClient = null;

// Initialize Supabase Client if valid config exists
if (typeof window.supabase !== 'undefined' && typeof SUPABASE_CONFIG !== 'undefined') {
  if (SUPABASE_CONFIG.url && SUPABASE_CONFIG.url !== 'YOUR_SUPABASE_URL_HERE' &&
      SUPABASE_CONFIG.anonKey && SUPABASE_CONFIG.anonKey !== 'YOUR_SUPABASE_ANON_KEY_HERE') {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    } catch (e) {
      console.warn('Supabase initialization error:', e);
    }
  }
}

let lastAnswer = '';
let memory = 0;
let angle = 'DEG';         // 'DEG' or 'RAD'
let justCalculated = false;

// --------------------------------------------------------------------------
// UI & Mode Controllers
// --------------------------------------------------------------------------

function setMode(mode) {
  currentMode = mode;
  if (mode === 'scientific') {
    calculatorCard.classList.add('mode-scientific');
    tabScientific.classList.add('active');
    tabScientific.setAttribute('aria-selected', 'true');
    tabBasic.classList.remove('active');
    tabBasic.setAttribute('aria-selected', 'false');
    modeHint.textContent = isPremium ? 'Scientific Active' : 'Scientific (Locked)';
  } else {
    calculatorCard.classList.remove('mode-scientific');
    tabBasic.classList.add('active');
    tabBasic.setAttribute('aria-selected', 'true');
    tabScientific.classList.remove('active');
    tabScientific.setAttribute('aria-selected', 'false');
    modeHint.textContent = 'Free Mode';
  }
}

// Intercept scientific actions: gate behind entitlement
function handleScientificAction(actionName, param) {
  if (!isPremium) {
    openUpgradeModal();
    return;
  }

  if (actionName === 'handleTrig') {
    handleTrig(param);
  } else if (actionName === 'appendValue') {
    appendValue(param);
  } else if (actionName === 'randomNumber') {
    randomNumber();
  }
}

// --------------------------------------------------------------------------
// Modal Management (Upgrade & Auth)
// --------------------------------------------------------------------------

function openUpgradeModal() {
  if (upgradeModal) {
    upgradeModal.classList.add('open');
  }
}

function closeUpgradeModal() {
  if (upgradeModal) {
    upgradeModal.classList.remove('open');
  }
}

function openAuthModal() {
  if (authModal) {
    authModal.classList.add('open');
  }
}

function closeAuthModal() {
  if (authModal) {
    authModal.classList.remove('open');
  }
}

function onBackdropClick(event, modalId) {
  if (event.target.id === modalId) {
    if (modalId === 'upgrade-modal') closeUpgradeModal();
    if (modalId === 'auth-modal') closeAuthModal();
  }
}

let selectedPlan = 'yearly'; // 'monthly' or 'yearly'

function selectPricingPlan(plan) {
  selectedPlan = plan;
  const optMonthly = document.getElementById('plan-opt-monthly');
  const optYearly = document.getElementById('plan-opt-yearly');
  const radioMonthly = document.getElementById('radio-monthly');
  const radioYearly = document.getElementById('radio-yearly');
  const checkoutLabel = document.getElementById('btn-checkout-label');

  if (plan === 'monthly') {
    if (optMonthly) optMonthly.classList.add('active');
    if (optYearly) optYearly.classList.remove('active');
    if (radioMonthly) radioMonthly.checked = true;
    if (radioYearly) radioYearly.checked = false;
    if (checkoutLabel) checkoutLabel.textContent = 'Upgrade Monthly \u2014 \u20B9100/month';
  } else {
    if (optYearly) optYearly.classList.add('active');
    if (optMonthly) optMonthly.classList.remove('active');
    if (radioYearly) radioYearly.checked = true;
    if (radioMonthly) radioMonthly.checked = false;
    if (checkoutLabel) checkoutLabel.textContent = 'Upgrade Annual \u2014 \u20B91,000/year (Save 17%)';
  }
}

// Simulated checkout handler (ready to be replaced with Stripe API in Phase 7)
function handleUpgradeCheckout() {
  // Demonstration simulated activation for testing UI states
  isPremium = !isPremium;
  updateEntitlementUI();
  closeUpgradeModal();
}

function updateEntitlementUI() {
  if (isPremium) {
    if (planBadgeBtn) {
      planBadgeBtn.className = 'plan-badge premium';
      planBadgeBtn.title = 'Premium Active';
    }
    if (planText) planText.textContent = 'Premium Plan';
    if (sciLockIndicator) sciLockIndicator.textContent = 'ACTIVE';
    if (scientificPill) {
      scientificPill.textContent = 'Unlocked';
      scientificPill.style.background = 'rgba(16, 185, 129, 0.2)';
      scientificPill.style.color = '#10b981';
    }
    if (calculatorCard) calculatorCard.classList.remove('free-mode-locked');
    if (modeHint) modeHint.textContent = currentMode === 'scientific' ? 'Scientific Active' : 'Free Mode';
  } else {
    if (planBadgeBtn) {
      planBadgeBtn.className = 'plan-badge free';
      planBadgeBtn.title = 'View Subscription Details';
    }
    if (planText) planText.textContent = 'Free Plan';
    if (sciLockIndicator) sciLockIndicator.textContent = 'PRO';
    if (scientificPill) {
      scientificPill.textContent = 'Premium';
      scientificPill.style.background = 'rgba(255, 149, 0, 0.2)';
      scientificPill.style.color = '#ff9500';
    }
    if (calculatorCard) calculatorCard.classList.add('free-mode-locked');
    if (modeHint) modeHint.textContent = currentMode === 'scientific' ? 'Scientific (Locked)' : 'Free Mode';
  }
}

function setAuthTab(tab) {
  activeAuthTab = tab;
  const tabSignIn = document.getElementById('tab-auth-signin');
  const tabSignUp = document.getElementById('tab-auth-signup');
  const submitBtn = document.getElementById('auth-submit-btn');
  const statusMsg = document.getElementById('auth-status-msg');
  if (statusMsg) statusMsg.textContent = '';

  if (tab === 'signin') {
    if (tabSignIn) tabSignIn.classList.add('active');
    if (tabSignUp) tabSignUp.classList.remove('active');
    if (submitBtn) submitBtn.textContent = 'Sign In';
  } else {
    if (tabSignUp) tabSignUp.classList.add('active');
    if (tabSignIn) tabSignIn.classList.remove('active');
    if (submitBtn) submitBtn.textContent = 'Create Account';
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const email = emailInput ? emailInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';
  const statusMsg = document.getElementById('auth-status-msg');
  const submitBtn = document.getElementById('auth-submit-btn');

  if (!supabaseClient) {
    if (statusMsg) {
      statusMsg.style.color = '#ff9500';
      statusMsg.textContent = 'Supabase keys pending: add your URL and anon key to config.js.';
    }
    return;
  }

  if (statusMsg) {
    statusMsg.style.color = '#8c93a8';
    statusMsg.textContent = 'Authenticating...';
  }
  if (submitBtn) submitBtn.disabled = true;

  try {
    const isSignUp = activeAuthTab === 'signup' ||
      document.getElementById('tab-auth-signup')?.classList.contains('active') ||
      submitBtn?.textContent.toLowerCase().includes('create');

    if (isSignUp) {
      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;
      if (statusMsg) {
        statusMsg.style.color = '#10b981';
        statusMsg.textContent = 'Account created! Check your email to confirm or sign in.';
      }
    } else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (statusMsg) {
        statusMsg.style.color = '#10b981';
        statusMsg.textContent = 'Signed in successfully!';
      }
      setTimeout(() => closeAuthModal(), 600);
    }
  } catch (err) {
    if (statusMsg) {
      statusMsg.style.color = '#ff5e57';
      statusMsg.textContent = err.message || 'Authentication error.';
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function onUserSignedIn(user) {
  currentUser = user;
  if (authHeaderBtn) {
    const email = user.email || 'User';
    const shortEmail = email.length > 18 ? email.slice(0, 15) + '...' : email;
    authHeaderBtn.innerHTML = `<span>${shortEmail}</span> &middot; <span style="color:#ff5e57; cursor:pointer;" onclick="handleSignOut(event)">Sign Out</span>`;
    authHeaderBtn.onclick = null;
  }
  closeAuthModal();
}

function onUserSignedOut() {
  currentUser = null;
  if (authHeaderBtn) {
    authHeaderBtn.textContent = 'Sign In';
    authHeaderBtn.onclick = openAuthModal;
  }
  isPremium = false;
  updateEntitlementUI();
}

async function handleSignOut(event) {
  if (event) event.stopPropagation();
  if (supabaseClient) {
    try {
      await supabaseClient.auth.signOut();
    } catch (e) {
      console.warn('Sign out error:', e);
    }
  }
  onUserSignedOut();
}

// Check session on page load
if (supabaseClient) {
  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session && session.user) {
      onUserSignedIn(session.user);
    }
  });

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session && session.user) {
      onUserSignedIn(session.user);
    } else {
      onUserSignedOut();
    }
  });
}

// --------------------------------------------------------------------------
// Core Mathematical Calculation Engine
// --------------------------------------------------------------------------

function snapZero(val) {
  if (typeof val === 'number' && Math.abs(val) < 1e-12) {
    return 0;
  }
  return val;
}

function updateMemoryBadge() {
  if (memoryBadge) {
    memoryBadge.style.display = memory !== 0 ? 'inline-block' : 'none';
  }
}

function evaluateExpression(expr, angleMode = 'DEG', prevAns = 0) {
  if (!expr || !expr.trim()) return '';

  let sanitized = expr.replace(/\bAns\b/g, `(${prevAns || 0})`);

  const degToRad = (x) => (x * Math.PI) / 180;
  const radToDeg = (x) => (x * 180) / Math.PI;

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
      // Expression error ignored
    }
  } else if (fn === 'Ans') {
    appendValue('Ans');
  }
}

function angleMode() {
  angle = angle === 'DEG' ? 'RAD' : 'DEG';
  if (angleBadge) {
    angleBadge.textContent = angle;
  }
}

function handleTrig(fn) {
  appendValue(fn + '(');
}

function randomNumber() {
  const rand = snapZero(Math.random());
  appendValue(rand.toFixed(4));
}

// Global Keyboard Listener
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && !e.target.disabled) return;

  if (e.key === 'Escape') {
    closeUpgradeModal();
    closeAuthModal();
    return;
  }

  if ((e.key >= '0' && e.key <= '9') || ['+', '-', '*', '/', '.', '(', ')', '^', 'E', 'e', '%', '!'].includes(e.key)) {
    appendValue(e.key);
    e.preventDefault();
  } else if (e.key === 'Enter' || e.key === '=') {
    calculate();
    e.preventDefault();
  } else if (e.key === 'Backspace') {
    deleteChar();
    e.preventDefault();
  } else if (e.key.toLowerCase() === 'c') {
    clearDisplay();
    e.preventDefault();
  }
});

// Initialize UI on load
updateEntitlementUI();
