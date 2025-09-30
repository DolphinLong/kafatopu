/**
 * ========================================
 * SLIME SOCCER - HYPER EDITION
 * Advanced HTML5 Canvas Game Engine
 * ========================================
 * 
 * Features:
 * - Real-time physics simulation
 * - AI opponent with multiple difficulty levels
 * - Power-up system with temporary effects
 * - Mobile-responsive touch controls
 * - Multiple visual themes
 * - Advanced error handling and recovery
 * - Memory management and performance optimization
 */

// --- Enhanced Audio Synthesis System ---
/**
 * Audio synthesis module for game sound effects
 * Uses Web Audio API for real-time sound generation
 */
const Sound = (() => {
  let ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    console.warn("Audio context not available:", e);
    return {
      kick: () => {}, goal: () => {}, power: () => {}, click: () => {},
      bounce: () => {}, combo: () => {}, freeze: () => {}, fire: () => {},
      goalFanfare: () => {}
    };
  }

  /**
   * Generate a synthesized beep sound
   * @param {number} freq - Frequency in Hz 
   * @param {number} dur - Duration in seconds
   * @param {string} type - Oscillator type
   * @param {number} gain - Volume level
   * @param {boolean} fadeOut - Apply fade-out effect
   */
  function beep(freq=440, dur=0.08, type='square', gain=0.05, fadeOut=true){
    try {
      if (!ctx || ctx.state === 'closed') return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = gain;
      if (fadeOut) g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  return {
    kick(){ beep(120, .08, 'sine', .12); setTimeout(()=>beep(80,.05,'sine',.06), 40); },
    goal(){ beep(880,.25,'square',.1); setTimeout(()=>beep(660,.3,'square',.08), 150); setTimeout(()=>beep(440,.35,'square',.06), 300); },
    power(){ beep(520,.15,'triangle',.08); setTimeout(()=>beep(780,.1,'sine',.05), 80); },
    click(){ beep(420,.04,'triangle',.04); },
    bounce(){ beep(300,.03,'sine',.03); },
    combo(){ beep(660,.12,'triangle',.07); setTimeout(()=>beep(880,.1,'triangle',.05), 60); },
    freeze(){ beep(200,.2,'sawtooth',.06); },
    fire(){ beep(800,.15,'square',.07); setTimeout(()=>beep(600,.1,'square',.05), 80); },
    goalFanfare(){ 
      const melody = [880, 1046.5, 1318.5, 1568];
      melody.forEach((f, i) => setTimeout(() => beep(f, .15, 'square', .1, true), i * 150));
    }
  }
})();

// --- Mathematical Utility Functions ---
const clamp=(n,mi,ma)=>Math.max(mi,Math.min(ma,n));
const rand=(a,b)=>Math.random()*(b-a)+a;
const lerp=(a,b,t)=>a+(b-a)*t;

/**
 * Main Game Class - Handles all game logic, physics, rendering, and state management
 */
class Game {
  constructor(){
    // Enhanced error handling system
    this.errorCount = 0;
    this.maxErrors = 5;
    this.lastErrorTime = 0;
    
    // Performance-optimized timer management
    this.activeTimeouts = new Map();
    this.timeoutIdCounter = 0;
    this.animationFrameId = null;
    this.isRunning = false;
    
    // Performance optimization: idle callback queue
    this.idleCallbacks = [];
    this.lastIdleTime = 0;

    try {
      this.initializeGame();
    } catch (e) {
      this.handleError("Constructor error", e);
    }
  }

  /**
   * Initialize all game systems and DOM references
   */
  initializeGame() {
    // DOM elements with null checks
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas?.getContext('2d');
    this.menu = document.getElementById('menu');
    this.ui = document.getElementById('ui');
    this.legend = document.getElementById('legend');
    this.powerIndicator = document.getElementById('powerIndicator');
    this.fxRoot = document.getElementById('fx-root');
    this.touchpad = document.getElementById('touchpad');
    this.timeEl = document.getElementById('time');
    this.p1sEl = document.getElementById('p1s');
    this.p2sEl = document.getElementById('p2s');
    this.errorEl = document.getElementById('errorMessage');

    if (!this.canvas || !this.ctx) {
      throw new Error("Canvas initialization failed");
    }

    // Game settings
    this.mode = 'soccer';
    this.theme = 'stadium';
    this.gravitySetting = 'normal';
    this.setDifficulty('normal');

    // Physics constants - carefully tuned for realistic gameplay
    this.gravity = 0.5;        // Downward acceleration (pixels/frame²)
    this.friction = 0.85;      // Ground friction coefficient (0-1)
    this.bounceDecay = 0.8;    // Energy loss on collision (0-1)

    // Initialize entities
    this.resetEntities();

    // Game state
    this.state = 'menu';
    this.score = {p1:0, p2:0};
    this.timeLeft = 90;
    this.keys = {};
    this.particles = [];
    this.ballTrail = [];
    this.powerUps = [];
    this.lastSpawn = 0;
    this.winningScore = 5;
    this.lastScoredPlayer = null;
    this.frameCount = 0;

    // Enhanced features
    this.combo = {p1: 0, p2: 0};
    this.lastHit = {player: null, time: 0};
    this.screenShake = 0;

    // Initialize controls
    this.bindKeys();
    this.bindUI();
    this.resizeForMobile();
    
    // Visibility change handler
    this._onVisibilityChange = () => {
      if (document.hidden && this.state === 'playing') {
        this.togglePause();
      }
    };
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  }

  // --- Enhanced Error Handling ---
  /**
   * Centralized error handling with recovery mechanisms
   * @param {string} context - Description of error location
   * @param {Error} error - The error object
   */
  handleError(context, error) {
    console.error(`${context}:`, error);
    this.errorCount++;
    this.lastErrorTime = Date.now();
    
    if (this.errorEl) {
      this.errorEl.textContent = `Hata: ${context}`;
      this.errorEl.style.display = 'block';
      this.createTimeout(() => {
        if (this.errorEl) this.errorEl.style.display = 'none';
      }, 3000);
    }

    if (this.errorCount >= this.maxErrors) {
      this.emergencyReset();
    }
  }

  /**
   * Emergency reset when critical errors occur
   */
  emergencyReset() {
    console.warn("Emergency reset triggered");
    this.clearAllTimers();
    this.state = 'menu';
    this.errorCount = 0;
    
    try {
      if (this.menu) this.menu.classList.remove('hidden');
      if (this.ui) this.ui.classList.add('hidden');
      if (this.canvas) this.canvas.classList.add('hidden');
    } catch (e) {
      console.error("Error in emergency reset:", e);
    }
  }

  // --- Performance-Optimized Timer Management ---
  /**
   * Create managed timeout with automatic cleanup
   * @param {Function} callback - Function to execute
   * @param {number} delay - Delay in milliseconds
   * @returns {number} Timer ID
   */
  createTimeout(callback, delay) {
    const id = ++this.timeoutIdCounter;
    const safeDelay = Math.min(Math.max(delay, 0), 10000);
    
    const timeoutId = setTimeout(() => {
      if (this.activeTimeouts.has(id)) {
        this.activeTimeouts.delete(id);
        try {
          callback();
        } catch (e) {
          this.handleError("Timeout callback error", e);
        }
      }
    }, safeDelay);
    
    this.activeTimeouts.set(id, timeoutId);
    
    // Memory management - max 20 timeouts
    if (this.activeTimeouts.size > 20) {
      const firstKey = this.activeTimeouts.keys().next().value;
      const firstTimeout = this.activeTimeouts.get(firstKey);
      clearTimeout(firstTimeout);
      this.activeTimeouts.delete(firstKey);
    }
    
    return id;
  }

  clearTimeout(id) {
    if (this.activeTimeouts.has(id)) {
      clearTimeout(this.activeTimeouts.get(id));
      this.activeTimeouts.delete(id);
    }
  }

  /**
   * Clean up all timers and prevent memory leaks
   */
  clearAllTimers() {
    for (const [id, timeoutId] of this.activeTimeouts) {
      clearTimeout(timeoutId);
    }
    this.activeTimeouts.clear();
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    this.isRunning = false;
  }

  /**
   * Performance optimization using requestIdleCallback
   * @param {Function} callback - Function to execute during idle time
   */
  scheduleIdleCallback(callback) {
    this.idleCallbacks.push(callback);
  }

  /**
   * Process idle callbacks when browser is not busy
   */
  processIdleCallbacks() {
    if (this.idleCallbacks.length === 0) return;
    
    const processCallback = (deadline) => {
      while (this.idleCallbacks.length > 0 && deadline.timeRemaining() > 0) {
        const callback = this.idleCallbacks.shift();
        try {
          callback();
        } catch (e) {
          this.handleError("Idle callback error", e);
        }
      }
    };

    if (window.requestIdleCallback) {
      requestIdleCallback(processCallback);
    } else {
      setTimeout(() => {
        const fakeDeadline = { timeRemaining: () => 5 };
        processCallback(fakeDeadline);
      }, 16);
    }
  }

  // --- Game Loop with Performance Optimization ---
  startLoop() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.frameCount = 0;
    this.lastIdleTime = performance.now();
    this.loop();
  }

  /**
   * Main game loop - 60fps rendering with idle processing
   */
  loop = () => {
    if (!this.isRunning || this.state !== 'playing') {
      this.isRunning = false;
      return;
    }

    try {
      this.update();
      this.render();
      this.frameCount++;
      
      // Process idle callbacks periodically
      const now = performance.now();
      if (now - this.lastIdleTime > 100) {
        this.processIdleCallbacks();
        this.lastIdleTime = now;
      }
      
      if (this.frameCount > 100000) {
        this.frameCount = 0;
      }
    } catch (e) {
      this.handleError("Game loop error", e);
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  // --- Game State Management ---
  /**
   * Start new game with specified settings
   */
  start(mode='soccer', gravity='normal', diff='normal', theme='stadium'){
    try {
      this.clearAllTimers();
      
      if (!this.ctx || this.ctx.canvas.width === 0) {
        throw new Error("Invalid canvas context");
      }
      
      this.mode = mode; 
      this.gravitySetting = gravity;
      this.setDifficulty(diff); 
      this.theme = theme;
      
      // UI updates
      this.menu?.classList.add('hidden');
      this.ui?.classList.remove('hidden');
      this.legend?.classList.remove('hidden');
      this.powerIndicator?.classList.remove('hidden');
      this.canvas?.classList.remove('hidden');
      
      // Reset game state
      this.state = 'playing'; 
      this.score = {p1:0, p2:0}; 
      this.timeLeft = 90; 
      this.combo = {p1:0, p2:0}; 
      this.powerUps = [];
      this.particles = [];
      this.ballTrail = [];
      this.lastScoredPlayer = null;
      this.errorCount = 0;
      
      this.resetEntities();
      this.applyTheme();
      this.setGameRules();
      
      if (this.p1sEl) this.p1sEl.textContent = '0';
      if (this.p2sEl) this.p2sEl.textContent = '0';
      if (this.timeEl) this.timeEl.textContent = '90';
      
      this.startLoop();
      
    } catch (e) {
      this.handleError("Start game error", e);
    }
  }

  restart(){
    this.start(this.mode, this.gravitySetting, this.difficulty, this.theme);
  }

  /**
   * Toggle pause state
   */
  togglePause(){
    try {
      if(this.state === 'playing'){ 
        this.state = 'paused';
        this.isRunning = false;
        if (this.animationFrameId) {
          cancelAnimationFrame(this.animationFrameId);
          this.animationFrameId = null;
        }
        this.toast('Duraklatıldı ⏸️', 700); 
      } else if (this.state === 'paused') { 
        this.state = 'playing'; 
        this.toast('Devam! ▶️', 600); 
        this._lastTime = performance.now();
        this.startLoop();
      }
    } catch (e) {
      this.handleError("Pause error", e);
    }
  }

  /**
   * End game and show results
   */
  endGame(){
    if(this.state !== 'playing') return;
    
    try {
      this.state = 'ended';
      this.clearAllTimers();

      let winner = 'Berabere';
      if (this.score.p1 > this.score.p2) winner = 'Oyuncu 1';
      else if (this.score.p2 > this.score.p1) winner = 'Oyuncu 2';
      
      this.toast(`🎉 ${winner} kazandı!`, 2000);
      
      this.createTimeout(() => {
        this.menu?.classList.remove('hidden');
        this.ui?.classList.add('hidden');
        this.legend?.classList.add('hidden');
        this.powerIndicator?.classList.add('hidden');
        this.canvas?.classList.add('hidden');
        this.state = 'menu';
      }, 2100);
      
    } catch (e) {
      this.handleError("End game error", e);
    }
  }

  // --- AI System ---
  /**
   * Configure AI difficulty settings
   */
  setDifficulty(mode){
    this.difficulty = mode;
    const settings = {
      easy: {speed: 0.7, jump: 0.015, track: 0.8, react: 0.9},
      hard: {speed: 1.7, jump: 0.065, track: 1.5, react: 1.3},
      expert: {speed: 2.0, jump: 0.08, track: 1.8, react: 1.6},
      normal: {speed: 1.2, jump: 0.035, track: 1.1, react: 1.0}
    };
    
    const setting = settings[mode] || settings.normal;
    this.aiSpeed = setting.speed;
    this.aiJumpProb = setting.jump;
    this.aiTrack = setting.track;
    this.aiReact = setting.react;
  }

  /**
   * Reset all entities to starting positions
   */
  resetEntities(){
    if (!this.canvas) return;
    
    const w = this.canvas.width;
    this.player1 = { x: 160, y: 420, vx:0, vy:0, r:40, color:'#00e676', onGround:false, speedMul:1, jumpMul:1, powers:[] };
    this.player2 = { x: w-160, y: 420, vx:0, vy:0, r:40, color:'#ff5252', onGround:false, speedMul:1, jumpMul:1, powers:[] };
    this.ball = { x: w/2, y: 280, vx:0, vy:0, r:15, color:'#ff0', bigUntil:0, frozen:false, onFire:false, lastBounce:0, lastTouchedBy: null };
    this.goals = { left:{ x:0, y:450, w:86, h:150 }, right:{ x:w-86, y:450, w:86, h:150 } };
  }

  /**
   * Apply physics rules based on gravity setting
   */
  setGameRules(){
    this.ball.r = 15;
    this.gravity = 0.5;
    this.friction = 0.85;
    this.bounceDecay = 0.8;
    this.powerUpSpawnRate = 3000;
    
    if (this.gravitySetting === 'low') {
      this.gravity = 0.2;
      if(this.player1) this.player1.jumpMul = 2.0;
      if(this.player2) this.player2.jumpMul = 2.0;
    } else if (this.gravitySetting === 'high') {
      this.gravity = 0.8;
      if(this.player1) this.player1.jumpMul = 0.7;
      if(this.player2) this.player2.jumpMul = 0.7;
    }
  }

  /**
   * Apply visual theme
   */
  applyTheme(){
    const body = document.body;
    if (!body) return;
    
    const themes = {
      beach: 'linear-gradient(135deg, #FFDD95 0%, #00C2FF 100%)',
      space: 'radial-gradient(50% 50% at 50% 30%, #2a2a72 0%, #000 80%)',
      neon: 'linear-gradient(135deg, #FF006E 0%, #8338EC 50%, #3A86FF 100%)',
      retro: 'linear-gradient(45deg, #f06, #48f, #0f9, #ff0, #f60)',
      stadium: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    };
    
    body.style.background = themes[this.theme] || themes.stadium;
  }

  // --- Update Logic ---
  /**
   * Main update function called every frame
   */
  update(){
    try {
      if (!this.ctx || !this.canvas) return;
      
      this.tickTime();
      this.handleInput();
      if(this.mode === 'single') this.updateAI();
      this.updatePhysics();
      this.handlePlayerBallCollisions();
      this.checkGoals();
      this.updateParticles();
      this.spawnPowerUps();
      this.checkPowerUpPickup();
      this.updatePowerEffects();
      this.updateBallTrail();
      this.updateScreenShake();
      this.updateActivePowersDisplay();
      
    } catch (e) {
      this.handleError("Update error", e);
    }
  }

  /**
   * Handle game timer
   */
  tickTime(){
    try {
      if (!this._lastTime) this._lastTime = performance.now();
      const now = performance.now();
      
      if (now - this._lastTime >= 1000) {
        this.timeLeft = Math.max(0, this.timeLeft - 1);
        if (this.timeEl) this.timeEl.textContent = this.timeLeft;
        this._lastTime = now;
        
        if (this.timeLeft === 0) this.endGame();
      }
    } catch (e) {
      this.handleError("Time tick error", e);
    }
  }
    
  /**
   * Process player input
   */
  handleInput(){
    if (!this.player1 || !this.player2) return;
    
    try {
      const p1 = this.player1;
      if (this.keys['a']) p1.vx -= 1.2 * (p1.speedMul || 1);
      if (this.keys['d']) p1.vx += 1.2 * (p1.speedMul || 1);
      if (this.keys['w'] && p1.onGround) { 
        p1.vy = -15 * (p1.jumpMul || 1); 
        p1.onGround = false; 
        this.makeDust(p1); 
        Sound.kick(); 
      }

      if (this.mode === 'soccer') {
        const p2 = this.player2;
        if (this.keys['arrowleft']) p2.vx -= 1.2 * (p2.speedMul || 1);
        if (this.keys['arrowright']) p2.vx += 1.2 * (p2.speedMul || 1);
        if (this.keys['arrowup'] && p2.onGround) { 
          p2.vy = -15 * (p2.jumpMul || 1); 
          p2.onGround = false; 
          this.makeDust(p2); 
          Sound.kick(); 
        }
      }

      // Update power effects
      const t = performance.now();
      [this.player1, this.player2].forEach(p => {
        if (!p.powers) p.powers = [];
        p.powers = p.powers.filter(power => t < power.until);
        p.speedMul = 1; 
        p.jumpMul = 1;
        p.powers.forEach(power => {
          if (power.type === 'speed') p.speedMul = Math.max(p.speedMul, 1.6);
          if (power.type === 'jump') p.jumpMul = Math.max(p.jumpMul, 1.7);
        });
      });

      if (this.ball.bigUntil && t > this.ball.bigUntil) { 
        this.ball.r = 15; 
        this.ball.bigUntil = 0; 
      }
    } catch (e) {
      this.handleError("Input handling error", e);
    }
  }

  /**
   * AI behavior for single player mode
   */
  updateAI(){
    if (!this.player2 || !this.ball) return;
    
    try {
      const ai = this.player2; 
      const b = this.ball;
      const targetX = this.calculateAITarget();
      const diff = targetX - ai.x;
      
      if (Math.abs(diff) > 15) {
        const moveForce = Math.sign(diff) * 0.6 * this.aiTrack * this.aiReact;
        ai.vx += moveForce;
      }

      const ballDist = Math.hypot(b.x - ai.x, b.y - ai.y);
      const shouldJump = this.shouldAIJump(ballDist, b.y, ai);
      if (shouldJump && ai.onGround && Math.random() < this.aiJumpProb * 2) {
        ai.vy = -15 * ai.jumpMul; 
        ai.onGround = false; 
        this.makeDust(ai);
      }
      ai.x = clamp(ai.x, ai.r + 20, this.canvas.width - ai.r - 20);
    } catch (e) {
      this.handleError("AI update error", e);
    }
  }

  calculateAITarget(){
    const b = this.ball;
    const ai = this.player2;
    const goalCenter = this.canvas.width - 43;

    if (b.vx > 0 && b.x > this.canvas.width * 0.6) return b.x;
    if (b.x < this.canvas.width * 0.4) return lerp(ai.x, goalCenter, 0.3);
    return lerp(ai.x, b.x, 0.8);
  }

  shouldAIJump(ballDist, ballHeight, ai){
    const nearBall = ballDist < 120;
    const ballInAir = ballHeight < this.canvas.height - 100;
    const ballComingDown = this.ball.vy > 0;
    return nearBall && (ballInAir || ballComingDown);
  }

  /**
   * Core physics simulation
   */
  updatePhysics(){
    if (!this.player1 || !this.player2 || !this.ball || !this.canvas) return;
    
    try {
      const floor = this.canvas.height - 50;
      
      // Update players
      [this.player1, this.player2].forEach(p => {
        p.vy += this.gravity;
        p.vx *= this.friction;
        p.x += p.vx; 
        p.y += p.vy;
        
        if (p.y + p.r > floor) { 
          p.y = floor - p.r; 
          p.vy = 0; 
          p.onGround = true; 
        } else {
          p.onGround = false;
        }
        
        if (p.x - p.r < 0) { p.x = p.r; p.vx = 0; }
        if (p.x + p.r > this.canvas.width) { p.x = this.canvas.width - p.r; p.vx = 0; }
      });

      // Update ball
      const ball = this.ball;
      if (!ball.frozen) {
        ball.vy += this.gravity; 
        ball.vx *= 0.995; 
        ball.vy *= 0.995; 
        ball.x += ball.vx; 
        ball.y += ball.vy;
      }
      
      const t = performance.now();
      if (ball.y + ball.r > floor) { 
        ball.y = floor - ball.r; 
        ball.vy *= -this.bounceDecay;
        if (t - ball.lastBounce > 200) { 
          this.puff(ball.x, ball.y + ball.r, ball.color); 
          Sound.bounce(); 
          ball.lastBounce = t; 
        }
      }
      
      if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx *= -this.bounceDecay; }
      if (ball.x + ball.r > this.canvas.width) { ball.x = this.canvas.width - ball.r; ball.vx *= -this.bounceDecay; }
      if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy *= -this.bounceDecay; }
    } catch (e) {
      this.handleError("Physics update error", e);
    }
  }

  /**
   * Handle collisions between players and ball
   */
  handlePlayerBallCollisions(){
    if (!this.player1 || !this.player2 || !this.ball) return;
    
    try {
      const players = [this.player1, this.player2];
      
      players.forEach((p, index) => {
        const dx = this.ball.x - p.x;
        const dy = this.ball.y - p.y; 
        const dist = Math.hypot(dx, dy);
        
        if (dist < p.r + this.ball.r) {
          const ang = Math.atan2(dy, dx);
          const tx = p.x + Math.cos(ang) * (p.r + this.ball.r);
          const ty = p.y + Math.sin(ang) * (p.r + this.ball.r);
          this.ball.x = tx; 
          this.ball.y = ty;
          
          const force = 0.34;
          const powerMul = p.powers.some(pow => pow.type === 'speed') ? 1.3 : 1.0;
          this.ball.vx = Math.cos(ang) * force * 20 * powerMul + p.vx * 0.5;
          this.ball.vy = Math.sin(ang) * force * 20 * powerMul + p.vy * 0.5;
          
          this.ball.lastTouchedBy = index + 1;
          
          const t = performance.now();
          if (this.lastHit.player === index + 1 && t - this.lastHit.time < 2000) {
            this.combo[`p${index + 1}`]++;
            if (this.combo[`p${index + 1}`] >= 3) { 
              this.showCombo(index + 1, this.combo[`p${index + 1}`]); 
              Sound.combo(); 
            }
          } else {
            this.combo[`p${index + 1}`] = 1;
          }
          this.lastHit = {player: index + 1, time: t};
          
          this.spark(this.ball.x, this.ball.y, '#fff'); 
          this.screenShake = Math.min(this.screenShake + 3, 8);
          Sound.kick();
        }
      });
    } catch (e) {
      this.handleError("Collision detection error", e);
    }
  }
    
  /**
   * Check for goals
   */
  checkGoals(){
    if (!this.ball || !this.goals || !this.canvas) return;
    
    try {
      const b = this.ball;
      const L = this.goals.left;
      const R = this.goals.right;
      
      if (b.x - b.r < L.w && b.y > L.y && b.vx < 0) {
        if (this.lastScoredPlayer !== 'p2') { 
          this.score.p2++; 
          this.onGoal('Oyuncu 2'); 
          this.lastScoredPlayer = 'p2'; 
        }
      } else if (b.x + b.r > this.canvas.width - R.w && b.y > R.y && b.vx > 0) {
        if (this.lastScoredPlayer !== 'p1') { 
          this.score.p1++; 
          this.onGoal('Oyuncu 1'); 
          this.lastScoredPlayer = 'p1'; 
        }
      } else {
        if (this.lastScoredPlayer && b.x > L.w && b.x < this.canvas.width - R.w) {
          this.lastScoredPlayer = null;
        }
      }
      
      if (this.p1sEl) this.p1sEl.textContent = this.score.p1; 
      if (this.p2sEl) this.p2sEl.textContent = this.score.p2;
    } catch (e) {
      this.handleError("Goal check error", e);
    }
  }
    
  onGoal(who){
    Sound.goal();
    this.flash();
    this.toast('GOOOOOOL!', 900);
    this.screenShake = 15;
    this.resetAfterGoal();
    this.combo = {p1: 0, p2: 0};
  }

  resetAfterGoal(){
    if (!this.player1 || !this.player2 || !this.ball || !this.canvas) return;
    
    this.player1.x = 160; 
    this.player1.y = 420; 
    this.player1.vx = 0; 
    this.player1.vy = 0;
    this.player2.x = this.canvas.width - 160; 
    this.player2.y = 420; 
    this.player2.vx = 0; 
    this.player2.vy = 0;
    this.ball.x = this.canvas.width / 2; 
    this.ball.y = 260; 
    this.ball.vx = (Math.random() - 0.5) * 10; 
    this.ball.vy = 0;
    this.ball.frozen = false; 
    this.ball.onFire = false;
    
    this.createTimeout(() => { 
      this.lastScoredPlayer = null; 
    }, 500);
  }

  // --- PowerUps & Effects ---
  spawnPowerUps(){
    try {
      const now = performance.now();
      if (now - this.lastSpawn < this.powerUpSpawnRate) return;
      if (this.powerUps.length >= 2) return;
      
      if (Math.random() < 0.35) {
        const types = ['speed', 'jump', 'bigball'];
        const type = types[Math.floor(Math.random() * types.length)];
        const x = clamp(rand(80, this.canvas.width - 80), 80, this.canvas.width - 80);
        const y = this.canvas.height - 80;
        
        this.powerUps.push({ 
          type, x, y, r: 16, 
          born: now, pulse: 0 
        });
        this.lastSpawn = now;
      }
      
      this.powerUps = this.powerUps.filter(p => now - p.born < 12000);
    } catch (e) {
      this.handleError("PowerUp spawn error", e);
      this.powerUps = [];
    }
  }

  checkPowerUpPickup(){
    if (!this.player1 || !this.player2) return;
    
    try {
      const players = [this.player1, this.player2];
      this.powerUps = this.powerUps.filter(p => {
        let taken = false;
        players.forEach(pl => {
          const d = Math.hypot(pl.x - p.x, pl.y - p.y);
          if (d < pl.r + p.r) { 
            this.applyPower(pl, p.type); 
            taken = true; 
          }
        });
        return !taken;
      });
    } catch (e) {
      this.handleError("PowerUp pickup error", e);
    }
  }

  applyPower(pl, type){
    try {
      Sound.power();
      const now = performance.now();
      
      if (type === 'speed') { 
        pl.speedMul = 1.6; 
        pl.powers.push({type: 'speed', until: now + 5000}); 
        this.toast('Hız!', 550); 
      }
      if (type === 'jump') { 
        pl.jumpMul = 1.7; 
        pl.powers.push({type: 'jump', until: now + 5000}); 
        this.toast('Süper Zıplama!', 650); 
      }
      if (type === 'bigball') { 
        this.ball.r = 26; 
        this.ball.bigUntil = now + 5000; 
        this.toast('Büyük Top!', 650); 
      }
      this.spark(pl.x, pl.y - 20, '#ffd54f');
    } catch (e) {
      this.handleError("Apply power error", e);
    }
  }

  updatePowerEffects(){
    try {
      this.powerUps.forEach(p => { 
        p.pulse += 0.15; 
      });
    } catch (e) {
      this.handleError("PowerUp effects error", e);
    }
  }

  updateBallTrail(){
    try {
      if (!this.ball) return;
      
      const speed = (this.ball.vx || 0) * (this.ball.vx || 0) + (this.ball.vy || 0) * (this.ball.vy || 0);
      if (speed > 4) {
        this.ballTrail.push({ 
          x: this.ball.x || 0, 
          y: this.ball.y || 0, 
          life: 8 
        });
      }
      
      this.ballTrail = this.ballTrail.filter(t => {
        if (!t) return false;
        t.life--;
        return t.life > 0;
      });
      
      if (this.ballTrail.length > 15) {
        this.ballTrail.shift();
      }
    } catch (e) {
      this.handleError("Ball trail error", e);
      this.ballTrail = [];
    }
  }

  updateScreenShake(){
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - 0.3);
    }
  }

  updateActivePowersDisplay(){
    try {
      const activePowers = [];
      [this.player1, this.player2].forEach((p, i) => {
        if (p.powers) {
          p.powers.forEach(power => {
            if (power.type === 'speed') activePowers.push(`P${i+1}: Hız`);
            if (power.type === 'jump') activePowers.push(`P${i+1}: Zıplama`);
          });
        }
      });
      
      if (this.ball.bigUntil > performance.now()) {
        activePowers.push('Büyük Top');
      }
      
      const text = activePowers.length > 0 ? 
        `Aktif Güçler: ${activePowers.join(' • ')}` : 
        'Aktif Güçler: Yok';
      
      if (this.powerIndicator) {
        this.powerIndicator.textContent = text;
      }
    } catch (e) {
      this.handleError("Power display error", e);
    }
  }

  // --- Particles & FX ---
  makeDust(p){ 
    if (p) this.puff(p.x, this.canvas.height - 40, p.color); 
  }
    
  puff(x, y, color){ 
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: x + rand(-10, 10), 
        y: y + rand(-6, 6), 
        vx: rand(-2, 2), 
        vy: rand(-3, -0.2), 
        life: 20,
        c: color
      }); 
    } 
  }
    
  spark(x, y, color){ 
    for (let i = 0; i < 12; i++) {
      this.particles.push({
        x, y, 
        vx: rand(-4, 4), 
        vy: rand(-4, 0), 
        life: 18,
        c: color
      }); 
    } 
  }

  updateParticles(){
    try {
      if (this.particles.length > 100) {
        this.particles = this.particles.slice(-100);
      }
      
      this.particles = this.particles.filter(p => {
        if (!p) return false;
        
        p.x += p.vx || 0; 
        p.y += p.vy || 0; 
        p.vy = (p.vy || 0) + 0.18; 
        p.life = (p.life || 0) - 1; 
        
        return p.life > 0;
      });
    } catch (e) {
      this.handleError("Particle update error", e);
      this.particles = [];
    }
  }

  flash(){ 
    try {
      const f = document.createElement('div'); 
      f.className = 'flash'; 
      if (this.fxRoot) {
        this.fxRoot.appendChild(f); 
        this.createTimeout(() => {
          if (f.parentNode) f.remove();
        }, 450);
      }
    } catch (e) {
      this.handleError("Flash effect error", e);
    }
  }

  toast(text, ms = 900){
    try {
      const t = document.createElement('div'); 
      t.className = 'toast'; 
      t.textContent = text; 
      if (this.fxRoot) {
        this.fxRoot.appendChild(t);
        this.createTimeout(() => {
          if (t.parentNode) t.remove();
        }, ms);
      }
    } catch (e) {
      this.handleError("Toast error", e);
    }
  }

  showCombo(playerNum, comboCount){
    try {
      const combo = document.createElement('div');
      combo.className = 'combo-indicator';
      combo.textContent = `${comboCount}x COMBO!`;
      combo.style.color = playerNum === 1 ? '#00e676' : '#ff5252';
      if (this.fxRoot) {
        this.fxRoot.appendChild(combo);
        this.createTimeout(() => {
          if (combo.parentNode) combo.remove();
        }, 800);
      }
    } catch (e) {
      this.handleError("Combo display error", e);
    }
  }
    
  // --- Render System ---
  /**
   * Main rendering function with error handling
   */
  render(){
    if (!this.ctx || !this.canvas) return;
    
    try {
      const ctx = this.ctx;
      
      ctx.save();
      
      // Screen shake effect
      if (this.screenShake > 0) {
        ctx.translate(
          rand(-this.screenShake, this.screenShake), 
          rand(-this.screenShake, this.screenShake)
        );
      }
      
      this.drawBackground();
      this.drawGoals();
      this.drawBallTrail();
      
      if (this.player1) this.drawSlime(this.player1); 
      if (this.player2) this.drawSlime(this.player2);
      if (this.ball) this.drawBall();
      
      this.drawPowerUps();
      this.drawParticles();
      
      ctx.restore();
    } catch (e) {
      this.handleError("Render error", e);
    }
  }
    
  drawBackground(){
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    
    // Sky based on theme
    if (this.theme === 'beach') {
      const g = ctx.createLinearGradient(0, 0, 0, H); 
      g.addColorStop(0, '#9be0ff'); 
      g.addColorStop(1, '#ffe29a'); 
      ctx.fillStyle = g; 
      ctx.fillRect(0, 0, W, H);
    } else if (this.theme === 'space') {
      ctx.fillStyle = '#0b0b2b'; 
      ctx.fillRect(0, 0, W, H);
      // Stars
      for (let i = 0; i < 30; i++) { 
        ctx.globalAlpha = 0.65; 
        ctx.fillStyle = '#fff'; 
        ctx.fillRect(((i * 73) % W), ((i * 131) % H) * 0.5 + 10, 2, 2); 
        ctx.globalAlpha = 1; 
      }
    } else {
      ctx.fillStyle = 'rgba(135,206,235, 1)'; 
      ctx.fillRect(0, 0, W, H);
    }
    
    // Ground
    const fieldColor = this.theme === 'space' ? '#123' : '#228B22';
    ctx.fillStyle = fieldColor;
    ctx.fillRect(0, H - 50, W, 50);

    // Field markings
    ctx.strokeStyle = '#fff'; 
    ctx.lineWidth = 3; 
    ctx.setLineDash([10, 10]); 
    ctx.beginPath(); 
    ctx.moveTo(W / 2, 0); 
    ctx.lineTo(W / 2, H - 50); 
    ctx.stroke(); 
    ctx.setLineDash([]);
    
    ctx.beginPath(); 
    ctx.arc(W / 2, H - 50, 80, 0, Math.PI, true); 
    ctx.stroke();
  }

  drawGoals(){
    const ctx = this.ctx;
    const L = this.goals.left;
    const R = this.goals.right;
    
    ctx.strokeStyle = '#fff'; 
    ctx.lineWidth = 5; 
    
    // Left goal
    ctx.beginPath(); 
    ctx.moveTo(0, L.y); 
    ctx.lineTo(L.w, L.y); 
    ctx.lineTo(L.w, L.y + L.h); 
    ctx.stroke();
    
    // Right goal
    ctx.beginPath(); 
    ctx.moveTo(this.canvas.width, R.y); 
    ctx.lineTo(this.canvas.width - R.w, R.y); 
    ctx.lineTo(this.canvas.width - R.w, R.y + R.h); 
    ctx.stroke();
  }

  drawSlime(p){
    const ctx = this.ctx;
    
    // Body
    ctx.fillStyle = p.color; 
    ctx.beginPath(); 
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); 
    ctx.fill();
    
    // Shine
    ctx.fillStyle = 'rgba(255,255,255,.3)'; 
    ctx.beginPath(); 
    ctx.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.3, 0, Math.PI * 2); 
    ctx.fill();
    
    // Eyes
    ctx.fillStyle = '#000'; 
    ctx.beginPath(); 
    ctx.arc(p.x - 10, p.y - 10, 5, 0, Math.PI * 2); 
    ctx.arc(p.x + 10, p.y - 10, 5, 0, Math.PI * 2); 
    ctx.fill();
  }

  drawBall(){
    const ctx = this.ctx;
    const b = this.ball; 
    
    ctx.fillStyle = b.color; 
    ctx.beginPath(); 
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); 
    ctx.fill();
    
    ctx.fillStyle = 'rgba(255,255,255,.4)'; 
    ctx.beginPath(); 
    ctx.arc(b.x - 5, b.y - 5, 3, 0, Math.PI * 2); 
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; 
    ctx.lineWidth = 2; 
    ctx.beginPath(); 
    ctx.arc(b.x, b.y, b.r * 0.7, 0, Math.PI * 2); 
    ctx.moveTo(b.x - b.r * 0.7, b.y); 
    ctx.lineTo(b.x + b.r * 0.7, b.y); 
    ctx.stroke();
  }

  drawBallTrail(){
    if (!this.ballTrail || !this.ctx) return;
    
    this.ballTrail.forEach(t => {
      this.ctx.save();
      this.ctx.globalAlpha = t.life / 8;
      this.ctx.fillStyle = '#fff';
      this.ctx.beginPath();
      this.ctx.arc(t.x, t.y, 3, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });
  }

  drawPowerUps(){
    const ctx = this.ctx;
    
    this.powerUps.forEach(p => {
      const pulseSize = 1 + Math.sin(p.pulse) * 0.2;
      let emoji = '⚡'; 
      if (p.type === 'jump') emoji = '🦘'; 
      if (p.type === 'bigball') emoji = '🎯';
      
      ctx.save(); 
      ctx.font = `${20 * pulseSize}px system-ui, sans-serif`; 
      ctx.textAlign = 'center'; 
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, p.x, p.y);
      ctx.restore();
    });
  }

  drawParticles(){
    const ctx = this.ctx;
    
    this.particles.forEach(p => { 
      ctx.save(); 
      ctx.globalAlpha = Math.max(0, p.life / 20); 
      ctx.fillStyle = p.c; 
      ctx.beginPath(); 
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); 
      ctx.fill(); 
      ctx.restore(); 
    });
  }

  // --- Input System ---
  bindKeys(){
    this._onKeyDown = (e) => { this.keys[e.key.toLowerCase()] = true; };
    this._onKeyUp = (e) => { this.keys[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  bindUI(){
    const startBtn = document.getElementById('startBtn');
    const modeSelect = document.getElementById('modeSelect');
    const difficultyRow = document.getElementById('difficultyRow');

    if (modeSelect && difficultyRow) {
      const syncDifficultyVisibility = () => {
        const isSinglePlayer = modeSelect.value === 'single';
        difficultyRow.style.display = isSinglePlayer ? 'grid' : 'none';
      };
      modeSelect.addEventListener('change', syncDifficultyVisibility);
      syncDifficultyVisibility();
    }

    if (startBtn) {
      startBtn.addEventListener('click', () => {
        try {
          const mode = document.getElementById('modeSelect')?.value || 'soccer';
          const gravity = document.getElementById('gravitySelect')?.value || 'normal';
          const difficulty = document.getElementById('difficultySelect')?.value || 'normal';
          const theme = document.getElementById('themeSelect')?.value || 'stadium';
          this.start(mode, gravity, difficulty, theme);
        } catch (e) {
          this.handleError("Start button error", e);
        }
      });
    }
    
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        try {
          this.togglePause();
        } catch (e) {
          this.handleError("Pause button error", e);
        }
      });
    }
    
    const restartBtn = document.getElementById('restartBtn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        try {
          this.restart();
        } catch (e) {
          this.handleError("Restart button error", e);
        }
      });
    }
    
    // Touch controls
    const bindTouch = (id, key) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('touchstart', e => { 
          try {
            e.preventDefault(); 
            this.keys[key] = true; 
          } catch (err) {
            this.handleError("Touch start error", err);
          }
        });
        
        el.addEventListener('touchend', e => { 
          try {
            e.preventDefault(); 
            this.keys[key] = false; 
          } catch (err) {
            this.handleError("Touch end error", err);
          }
        });
      }
    };
    
    bindTouch('p1Left', 'a');
    bindTouch('p1Right', 'd');
    bindTouch('p1Jump', 'w');
  }

  resizeForMobile(){
    try {
      const isMobile = window.innerWidth < 768;
      
      if (this.canvas) {
        if (isMobile) {
          this.canvas.width = Math.min(window.innerWidth * 0.95, 800);
          this.canvas.height = Math.min(window.innerHeight * 0.7, 500);
        } else {
          this.canvas.width = 960;
          this.canvas.height = 600;
        }
      }
      
      if (this.touchpad) {
        if (isMobile) {
          this.touchpad.classList.remove('hidden');
        } else {
          this.touchpad.classList.add('hidden');
        }
      }
      
      this.resetEntities();
    } catch (e) {
      this.handleError("Resize error", e);
    }
  }

  // --- Cleanup ---
  destroy() {
    try {
      this.clearAllTimers();
      
      if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
      if (this._onKeyUp) window.removeEventListener('keyup', this._onKeyUp);
      if (this._onVisibilityChange) document.removeEventListener('visibilitychange', this._onVisibilityChange);
      
      this.canvas = null;
      this.ctx = null;
      this.particles = [];
      this.ballTrail = [];
      this.powerUps = [];
      
      console.log("Game destroyed successfully");
    } catch (e) {
      console.error("Error during cleanup:", e);
    }
  }
}

// --- Game Bootstrap ---
let game = null;

function initializeGame() {
  try {
    if (game) {
      game.destroy();
    }
    
    game = new Game();
    window.game = game; // For debugging
    
    console.log("Game initialized successfully");
  } catch (e) {
    console.error("Failed to initialize game:", e);
    
    const errorEl = document.getElementById('errorMessage');
    if (errorEl) {
      errorEl.textContent = 'Oyun başlatılamadı. Sayfa yenileyin.';
      errorEl.style.display = 'block';
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGame);
} else {
  initializeGame();
}

// Handle window events
window.addEventListener('resize', () => {
  if (game) {
    try {
      game.resizeForMobile();
    } catch (e) {
      console.error("Resize handler error:", e);
    }
  }
});

window.addEventListener('beforeunload', () => {
  if (game) {
    game.destroy();
  }
});

// Global error recovery
window.addEventListener('error', (e) => {
  console.error("Global error:", e);
  if (game && game.errorCount >= game.maxErrors) {
    console.warn("Restarting game due to excessive errors");
    setTimeout(initializeGame, 1000);
  }
});