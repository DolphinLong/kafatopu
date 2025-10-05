# Slime Soccer - Hyper Edition AI Assistant Guide

## Project Overview
This is an HTML5 Canvas-based multiplayer game featuring slime characters playing soccer. The project uses a robust, modular architecture with advanced features like physics simulation, AI opponents, power-ups, and visual effects.

## Core Architecture

### Main Components
- `game.js`: Core game engine with physics, AI, and state management
- `styles.css`: Modular CSS with responsive design and animations
- HTML: Game canvas and UI elements

### Key Systems
1. **Game Loop & Physics**
   ```javascript
   // Example from game.js
   update() {
     this.tickTime();
     this.handleInput();
     this.updatePhysics();
     this.handleCollisions();
     // ...
   }
   ```

2. **Error Recovery System**
   - Centralized error handling with recovery mechanisms
   - Error count tracking with emergency reset
   - Example: `this.handleError("Context", error)`

3. **Memory Management**
   - Particle system with automatic cleanup
   - Managed timeouts using `createTimeout()`
   - Performance optimization with `requestIdleCallback`

## Development Guidelines

### 1. Error Handling
- Always wrap critical operations in try-catch blocks
- Use the centralized error handler:
  ```javascript
  try {
    // Critical operation
  } catch (e) {
    this.handleError("Operation context", e);
  }
  ```

### 2. Performance Patterns
- Use `createTimeout()` instead of raw `setTimeout`
- Limit particle effects: `if (this.particles.length > 100)`
- Schedule non-critical updates using `scheduleIdleCallback`

### 3. State Management
- Game states: 'menu', 'playing', 'paused', 'ended'
- Player/ball physics parameters in `updatePhysics()`
- Power-up system with timed effects

### 4. Critical Workflows

#### Development Setup
1. Run with local server (required for audio):
   ```bash
   python -m http.server 8080
   ```
2. Access at `http://localhost:8080`

#### Testing
- Manual testing focus areas:
  - Physics collisions
  - Power-up interactions
  - AI behavior at different difficulties
  - Memory management (long sessions)
  - Mobile responsiveness

### 5. Mobile Support
- Responsive canvas sizing based on viewport
- Touch controls in portrait orientation
- CSS breakpoints at 768px for mobile adaptation

## Common Tasks

### Adding Power-Ups
1. Define in `powerUps` array
2. Implement pickup logic in `checkPowerUpPickup()`
3. Add visual effect in `drawPowerUps()`

### Modifying Physics
```javascript
// Key physics constants
this.gravity = 0.5;        // Downward acceleration
this.friction = 0.85;      // Ground friction
this.bounceDecay = 0.8;    // Energy loss on collision
```

### Adding Visual Effects
1. Add particle system effect (see `makeDust()`, `spark()`)
2. Handle cleanup in `updateParticles()`
3. Implement render in `drawParticles()`

## Project Conventions

### Code Style
- Use camelCase for methods and variables
- Prefix private methods with underscore
- Group related functionality in comment-separated sections

### Performance Requirements
- Maintain 60fps target
- Particle limit: 100 max
- Screen shake < 15 units
- Error threshold: 5 before reset

### Audio Conventions
- Use Web Audio API for sound synthesis
- Fallback gracefully if audio unavailable
- Keep effects < 200ms for responsiveness

## Integration Points

### Game-UI Communication
- Score updates via DOM elements
- Power-up status in power indicator
- Toast messages for events

### Input Handling
- Keyboard: WASD + Arrow keys
- Touch: Virtual d-pad on mobile
- Pause/resume on visibility change

## Common Issues & Solutions

### Performance
- **Issue**: Frame drops on particle heavy scenes
  ```javascript
  // Solution: Limit particles
  if (this.particles.length > 100) {
    this.particles = this.particles.slice(-100);
  }
  ```

### Mobile
- **Issue**: Touch control lag
  ```css
  /* Solution: Disable highlight */
  -webkit-tap-highlight-color: transparent;
  touch-action: none;
  ```

### Memory
- **Issue**: Timer leaks
  ```javascript
  // Solution: Use managed timeouts
  this.createTimeout(() => {
    // Callback
  }, duration);
  ```