// Bottle Sort Puzzle Game Logic

class BottleSortGame {
    constructor() {
        // Game state
        this.score = 0;
        this.level = 1;
        this.moves = 0;
        this.gameActive = false;
        this.bottles = [];
        // Per-bottle Set of layer positions (0=bottom) that have been revealed.
        // Sealed bottles start with only the top position visible; each pour
        // reveals the next layer down.
        this.revealed = [];
        this.selectedBottle = null;
        this.moveHistory = [];

        // Game parameters
        this.bottleCapacity = 4;
        this.colors = [];

        // Settings
        this.soundEnabled = true;

        // Color palette
        this.colorPalette = [
            { name: 'red', class: 'color-red' },
            { name: 'blue', class: 'color-blue' },
            { name: 'green', class: 'color-green' },
            { name: 'yellow', class: 'color-yellow' },
            { name: 'purple', class: 'color-purple' },
            { name: 'orange', class: 'color-orange' },
            { name: 'pink', class: 'color-pink' },
            { name: 'cyan', class: 'color-cyan' }
        ];
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadSettings();
    }
    
    setupEventListeners() {
        // Helper to safely attach listeners
        const on = (id, event, handler) => {
            const el = document.getElementById(id);
            if (el && typeof el.addEventListener === 'function') {
                el.addEventListener(event, handler);
            }
            return el;
        };

        // Menu buttons
        on('play-btn', 'click', () => this.startGame());
        on('leaderboard-btn', 'click', () => this.showLeaderboard());
        on('settings-btn', 'click', () => this.showSettings());

        // Game screen
        on('undo-btn', 'click', () => this.undo());
        on('hint-btn', 'click', () => this.showHint());
        on('restart-btn', 'click', () => this.restartLevel());

        // Game over screen
        on('next-level-btn', 'click', () => this.nextLevel());
        on('menu-btn', 'click', () => this.showMenu());
        on('submit-score-btn', 'click', () => this.submitScore());

        // Leaderboard
        on('back-btn', 'click', () => this.showMenu());

        // Settings
        on('settings-back-btn', 'click', () => this.showMenu());
        on('sound-toggle', 'change', (e) => {
            this.soundEnabled = e.target.checked;
            localStorage.setItem('soundEnabled', this.soundEnabled);
        });
        on('reset-progress-btn', 'click', () => this.resetProgress());
    }

    loadSettings() {
        this.soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
        const soundEl = document.getElementById('sound-toggle');
        if (soundEl) soundEl.checked = this.soundEnabled;
    }

    // Deterministic PRNG (mulberry32) seeded from a level number.
    makeRng(seed) {
        let s = seed | 0;
        return () => {
            s = (s + 0x6D2B79F5) | 0;
            let t = s;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // Difficulty curve: more colors, then locked bottles, as level grows.
    getLevelConfig(level) {
        const numColors = Math.min(3 + Math.floor((level - 1) / 3), 8);
        const numEmpty = 2;
        const numBottles = numColors + numEmpty;
        let numLocked = Math.max(0, Math.floor((level - 1) / 5));
        numLocked = Math.min(numLocked, 3);
        numLocked = Math.min(numLocked, Math.max(0, numColors - 2));
        return { numColors, numBottles, numEmpty, numLocked, capacity: this.bottleCapacity };
    }

    seededShuffle(arr, rng) {
        const out = [...arr];
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    }

    resetProgress() {
        localStorage.removeItem('currentLevel');
        this.level = 1;
        this.showToast('Progress reset to level 1', 'success');
    }

    // A bottle is "sealed" if any of its current layers is still hidden.
    isBottleSealed(bottleIndex) {
        const bottle = this.bottles[bottleIndex];
        const seen = this.revealed[bottleIndex];
        if (!seen) return false;
        for (let p = 0; p < bottle.length; p++) {
            if (!seen.has(p)) return true;
        }
        return false;
    }

    isPositionHidden(bottleIndex, position) {
        const seen = this.revealed[bottleIndex];
        return !!seen && !seen.has(position);
    }
    
    startGame() {
        const stored = parseInt(localStorage.getItem('currentLevel') || '1', 10);
        this.level = (isNaN(stored) || stored < 1) ? 1 : stored;
        this.score = 0;
        this.moves = 0;
        this.moveHistory = [];
        this.selectedBottle = null;
        this.generateLevel();
        this.switchScreen('game-screen');
        this.gameActive = true;
        this.render();
        this.playSound('start');
    }

    generateLevel() {
        const config = this.getLevelConfig(this.level);
        // Seed combines the level with a constant so seeds aren't tiny ints.
        const rng = this.makeRng(Math.imul(this.level, 2654435761) ^ 0xC0FFEE);

        this.colors = this.colorPalette.slice(0, config.numColors);

        let colorArray = [];
        for (let i = 0; i < config.numColors; i++) {
            for (let j = 0; j < this.bottleCapacity; j++) {
                colorArray.push(i);
            }
        }
        colorArray = this.seededShuffle(colorArray, rng);

        this.bottles = [];
        for (let i = 0; i < config.numColors; i++) {
            const bottle = [];
            for (let j = 0; j < this.bottleCapacity; j++) {
                bottle.push(colorArray.pop());
            }
            this.bottles.push(bottle);
        }
        for (let i = 0; i < config.numEmpty; i++) {
            this.bottles.push([]);
        }

        // Pick which filled bottles start sealed (deterministic via same rng).
        const filledIndices = [];
        for (let i = 0; i < config.numColors; i++) filledIndices.push(i);
        const lockedSet = new Set(
            this.seededShuffle(filledIndices, rng).slice(0, config.numLocked)
        );

        // For sealed bottles, only the top position is initially revealed.
        // For everything else, every position is revealed.
        this.revealed = this.bottles.map((bottle, i) => {
            if (!lockedSet.has(i)) {
                const all = new Set();
                for (let p = 0; p < this.bottleCapacity; p++) all.add(p);
                return all;
            }
            return new Set([bottle.length - 1]);
        });

        this.moves = 0;
        this.moveHistory = [];
        this.selectedBottle = null;
        this.updateDisplay();
    }
    
    selectBottle(index) {
        if (!this.gameActive) return;
        
        const bottle = this.bottles[index];
        
        // If clicked bottle is empty:
        // - if no bottle currently selected, do nothing
        // - if another bottle is selected, attempt to pour into this empty bottle
        if (bottle.length === 0) {
            if (this.selectedBottle === null) return;
            // attempt pour from selectedBottle -> this empty bottle
            this.pourBottle(this.selectedBottle, index);
            return;
        }
        
        // If no bottle selected, select this one
        if (this.selectedBottle === null) {
            this.selectedBottle = index;
            this.render();
            this.playSound('select');
            return;
        }
        
        // If same bottle, deselect
        if (this.selectedBottle === index) {
            this.selectedBottle = null;
            this.render();
            return;
        }
        
        // Try to pour
        this.pourBottle(this.selectedBottle, index);
    }
    
    pourBottle(fromIndex, toIndex) {
        const fromBottle = this.bottles[fromIndex];
        const toBottle = this.bottles[toIndex];

        if (fromBottle.length === 0) {
            this.selectedBottle = null;
            this.render();
            return;
        }

        if (toBottle.length >= this.bottleCapacity) {
            this.selectedBottle = null;
            this.render();
            this.playSound('error');
            this.showToast('Bottle is full!', 'error');
            return;
        }

        if (toBottle.length > 0 && toBottle[toBottle.length - 1] !== fromBottle[fromBottle.length - 1]) {
            this.selectedBottle = null;
            this.render();
            this.playSound('error');
            this.showToast("Colors don't match!", 'error');
            return;
        }

        this.moveHistory.push({
            from: fromIndex,
            to: toIndex,
            bottles: this.bottles.map(b => [...b]),
            revealed: this.revealed.map(s => [...s])
        });

        const color = fromBottle[fromBottle.length - 1];
        const maxPour = this.bottleCapacity - toBottle.length;
        const seen = this.revealed[fromIndex];

        // Pour matching consecutive layers, but stop the moment we'd uncover
        // a previously-hidden layer (reveal it, then stop so the player can react).
        let poured = 0;
        while (poured < maxPour && fromBottle.length > 0 && fromBottle[fromBottle.length - 1] === color) {
            toBottle.push(fromBottle.pop());
            poured++;
            if (fromBottle.length > 0 && !seen.has(fromBottle.length - 1)) {
                seen.add(fromBottle.length - 1);
                break;
            }
        }

        this.moves++;
        this.selectedBottle = null;

        this.playSound('pour');
        this.render();

        if (this.checkWin()) {
            this.gameWon();
        }
    }
    
    checkWin() {
        for (let i = 0; i < this.bottles.length; i++) {
            const bottle = this.bottles[i];
            if (bottle.length === 0) continue;
            // Any still-hidden layer means the puzzle isn't fully solved.
            if (this.isBottleSealed(i)) return false;
            if (bottle.length === this.bottleCapacity) {
                const firstColor = bottle[0];
                if (bottle.every(color => color === firstColor)) continue;
            }
            return false;
        }
        return true;
    }
    
    undo() {
        if (this.moveHistory.length === 0) {
            this.showToast('Nothing to undo!', 'error');
            return;
        }
        
        const lastMove = this.moveHistory.pop();
        this.bottles = lastMove.bottles.map(b => [...b]);
        if (lastMove.revealed) this.revealed = lastMove.revealed.map(arr => new Set(arr));
        this.moves = Math.max(0, this.moves - 1);

        this.selectedBottle = null;
        this.render();
        this.playSound('undo');
    }
    
    showHint() {
        if (!this.gameActive) return;
        
        this.showToast('Look for bottles with the same color on top!', 'info');
        this.playSound('hint');
    }
    
    restartLevel() {
        this.generateLevel();
        this.render();
        this.playSound('start');
    }
    
    gameWon() {
        this.gameActive = false;
        
        // Calculate score based on moves and level
        const baseScore = 1000;
        const levelBonus = this.level * 100;
        const moveDeduction = Math.max(0, this.moves - 20) * 10;
        this.score = baseScore + levelBonus - moveDeduction;
        
        this.playSound('win');
        
        // Show game over screen (guard DOM elements)
        const finalScoreEl = document.getElementById('final-score');
        const finalMovesEl = document.getElementById('final-moves');
        const finalLevelEl = document.getElementById('final-level');

        if (finalScoreEl) finalScoreEl.textContent = this.score;
        if (finalMovesEl) finalMovesEl.textContent = this.moves;
        if (finalLevelEl) finalLevelEl.textContent = this.level;

        this.switchScreen('gameover-screen');
    }
    
    nextLevel() {
        this.level++;
        localStorage.setItem('currentLevel', String(this.level));
        this.score = 0;
        this.moves = 0;
        this.moveHistory = [];
        this.selectedBottle = null;
        this.generateLevel();
        this.switchScreen('game-screen');
        this.gameActive = true;
        this.render();
        this.playSound('start');
    }
    
    submitScore() {
        const playerEl = document.getElementById('player-name');
        const playerName = playerEl ? playerEl.value.trim() : 'Player';

        if (!playerName) {
            this.showToast('Please enter your name', 'error');
            return;
        }

        GameDB.saveScore(playerName, this.score, this.level, this.moves)
            .then(result => {
                if (result) {
                    this.showToast('Score submitted!', 'success');
                    setTimeout(() => this.showMenu(), 1000);
                } else {
                    this.showToast('Score saved locally (offline)', 'success');
                    setTimeout(() => this.showMenu(), 1000);
                }
            });
    }
    
    updateDisplay() {
        const scoreEl = document.getElementById('score-display');
        const levelEl = document.getElementById('level-display');
        const movesEl = document.getElementById('moves-display');
        const sortedEl = document.getElementById('sorted-display');

        if (scoreEl) scoreEl.textContent = this.score;
        if (levelEl) levelEl.textContent = this.level;
        if (movesEl) movesEl.textContent = this.moves;

        // Count sorted bottles (sealed bottles don't count even if their cap matches).
        let sorted = 0;
        for (let i = 0; i < this.bottles.length; i++) {
            const bottle = this.bottles[i];
            if (bottle.length === 0 || this.isBottleSealed(i)) continue;
            if (bottle.length === this.bottleCapacity) {
                const firstColor = bottle[0];
                if (bottle.every(color => color === firstColor)) sorted++;
            }
        }

        if (sortedEl) sortedEl.textContent = sorted;
    }
    
    render() {
        const grid = document.getElementById('bottles-grid');
        if (!grid) return;
        grid.innerHTML = '';
        
        const BODY_FACES = 12;
        const NECK_FACES = 8;

        this.bottles.forEach((bottle, index) => {
            const bottleElement = document.createElement('div');
            bottleElement.className = 'bottle';

            const isSealed = this.isBottleSealed(index);

            if (this.selectedBottle === index) {
                bottleElement.classList.add('selected');
            }

            if (isSealed) {
                bottleElement.classList.add('locked');
            } else if (bottle.length === this.bottleCapacity) {
                const firstColor = bottle[0];
                if (bottle.every(color => color === firstColor)) {
                    bottleElement.classList.add('sorted');
                }
            }

            // 3D scene
            const scene = document.createElement('div');
            scene.className = 'bottle-3d';

            // Body — faceted cylinder. Each face is a vertical panel rotated
            // around Y; together they approximate a cylinder. Each panel
            // contains the same vertical liquid stack, brightness-shaded by
            // its angle from the camera.
            const body = document.createElement('div');
            body.className = 'bottle-body';
            for (let f = 0; f < BODY_FACES; f++) {
                const angle = f * (360 / BODY_FACES);
                const face = document.createElement('div');
                face.className = 'body-face';
                face.style.transform = `rotateY(${angle}deg) translateZ(var(--body-radius))`;
                // Cosine shading: front (0°) brightest, sides darker.
                const shade = 0.45 + 0.55 * Math.cos(angle * Math.PI / 180);
                face.style.setProperty('--shade', Math.max(0.35, shade).toFixed(3));

                const layers = document.createElement('div');
                layers.className = 'face-layers';
                for (let i = 0; i < this.bottleCapacity; i++) {
                    const layer = document.createElement('div');
                    layer.className = 'face-layer';
                    if (i < bottle.length) {
                        if (this.isPositionHidden(index, i)) {
                            layer.classList.add('hidden-layer');
                        } else {
                            layer.classList.add(this.colors[bottle[i]].class);
                            if (i === bottle.length - 1) layer.classList.add('top-layer');
                        }
                    }
                    layers.appendChild(layer);
                }
                face.appendChild(layers);
                body.appendChild(face);
            }
            scene.appendChild(body);

            // Neck — smaller faceted mini-cylinder sitting on top of the body.
            // Only when the bottle is completely full does the neck wear the
            // top color (the liquid has reached the brim). Partially-filled
            // bottles keep their glass-tinted neck so the empty space remains
            // visible in the body below.
            const isFull = bottle.length === this.bottleCapacity;
            const topIdxForNeck = bottle.length - 1;
            const neckColorClass = (isFull && !this.isPositionHidden(index, topIdxForNeck))
                ? this.colors[bottle[topIdxForNeck]].class
                : null;
            const neck = document.createElement('div');
            neck.className = 'bottle-neck';
            for (let f = 0; f < NECK_FACES; f++) {
                const angle = f * (360 / NECK_FACES);
                const face = document.createElement('div');
                face.className = 'neck-face';
                if (neckColorClass) face.classList.add(neckColorClass);
                face.style.transform = `rotateY(${angle}deg) translateZ(var(--neck-radius))`;
                const shade = 0.5 + 0.5 * Math.cos(angle * Math.PI / 180);
                face.style.setProperty('--shade', Math.max(0.35, shade).toFixed(3));
                neck.appendChild(face);
            }
            scene.appendChild(neck);

            // Elliptical caps — top opening (dark) and bottom (subtle base).
            const topCap = document.createElement('div');
            topCap.className = 'bottle-top-cap';
            scene.appendChild(topCap);

            const botCap = document.createElement('div');
            botCap.className = 'bottle-bottom-cap';
            scene.appendChild(botCap);

            bottleElement.appendChild(scene);

            const check = document.createElement('div');
            check.className = 'bottle-check';
            check.textContent = '✓';
            bottleElement.appendChild(check);

            bottleElement.addEventListener('click', () => this.selectBottle(index));

            grid.appendChild(bottleElement);
        });
        
        this.updateDisplay();
    }
    
    async showLeaderboard() {
        this.switchScreen('leaderboard-screen');
        const container = document.getElementById('leaderboard-list');
        if (!container) return this.showToast('Leaderboard not available', 'error');
        container.innerHTML = '<p class="loading">Loading scores...</p>';
        
        const scores = await GameDB.getTopScores(10);
        
        if (scores && scores.length > 0) {
            container.innerHTML = scores.map((score, index) => {
                const rank = index + 1;
                return `
                    <div class="leaderboard-item rank-${rank}">
                        <div class="leaderboard-rank">#${rank}</div>
                        <div class="leaderboard-name">${score.player_name}</div>
                        <div class="leaderboard-score">${score.score}</div>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = '<p class="loading">No scores yet. Be the first!</p>';
        }
    }
    
    showSettings() {
        this.switchScreen('settings-screen');
    }
    
    showMenu() {
        this.switchScreen('menu-screen');
    }
    
    switchScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        const target = document.getElementById(screenId);
        if (target) {
            target.classList.add('active');
        }
    }
    
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.className = `toast show ${type}`;

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    
    playSound(type) {
        if (!this.soundEnabled) return;
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        switch (type) {
            case 'start':
                this.playTone(audioContext, 523, 0.1, 0.1);
                this.playTone(audioContext, 659, 0.1, 0.1, 0.15);
                break;
            case 'select':
                this.playTone(audioContext, 440, 0.05, 0.15);
                break;
            case 'pour':
                this.playTone(audioContext, 350, 0.1, 0.2);
                break;
            case 'error':
                this.playTone(audioContext, 200, 0.1, 0.2);
                break;
            case 'undo':
                this.playTone(audioContext, 659, 0.05, 0.1);
                this.playTone(audioContext, 523, 0.05, 0.1, 0.1);
                break;
            case 'hint':
                this.playTone(audioContext, 784, 0.05, 0.1);
                break;
            case 'win':
                this.playTone(audioContext, 659, 0.1, 0.1);
                this.playTone(audioContext, 784, 0.1, 0.1, 0.15);
                this.playTone(audioContext, 880, 0.1, 0.15, 0.3);
                break;
        }
    }
    
    playTone(audioContext, frequency, duration, volume, startTime = 0) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime + startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + startTime + duration);
        
        oscillator.start(audioContext.currentTime + startTime);
        oscillator.stop(audioContext.currentTime + startTime + duration);
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new BottleSortGame();
});
