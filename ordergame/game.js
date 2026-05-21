// Bottle Sort Puzzle Game Logic

class BottleSortGame {
    constructor() {
        // Game state
        this.score = 0;
        this.level = 1;
        this.moves = 0;
        this.gameActive = false;
        this.bottles = [];
        this.selectedBottle = null;
        this.moveHistory = [];
        
        // Game parameters
        this.bottleCapacity = 4;
        this.colors = [];
        this.numBottles = 5;
        this.numColors = 4;
        
        // Settings
        this.soundEnabled = true;
        this.difficulty = 'normal';
        
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
        const soundToggle = on('sound-toggle', 'change', (e) => {
            this.soundEnabled = e.target.checked;
            localStorage.setItem('soundEnabled', this.soundEnabled);
        });
        const difficultySelect = on('difficulty-select', 'change', (e) => {
            this.difficulty = e.target.value;
            localStorage.setItem('difficulty', this.difficulty);
            this.updateDifficultySettings();
        });
    }
    
    loadSettings() {
        this.soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
        this.difficulty = localStorage.getItem('difficulty') || 'normal';
        const soundEl = document.getElementById('sound-toggle');
        const diffEl = document.getElementById('difficulty-select');
        if (soundEl) soundEl.checked = this.soundEnabled;
        if (diffEl) diffEl.value = this.difficulty;
    }
    
    updateDifficultySettings() {
        switch (this.difficulty) {
            case 'easy':
                this.numColors = 3;
                this.numBottles = 4;
                break;
            case 'normal':
                this.numColors = 4;
                this.numBottles = 5;
                break;
            case 'hard':
                this.numColors = 5;
                this.numBottles = 6;
                break;
        }
    }
    
    startGame() {
        this.resetGame();
        this.updateDifficultySettings();
        this.generateLevel();
        this.switchScreen('game-screen');
        this.gameActive = true;
        this.render();
        this.playSound('start');
    }
    
    resetGame() {
        this.score = 0;
        this.level = 1;
        this.moves = 0;
        this.bottles = [];
        this.selectedBottle = null;
        this.moveHistory = [];
    }
    
    generateLevel() {
        this.bottles = [];
        this.moveHistory = [];
        this.moves = 0;
        
        // Select colors for this level
        this.colors = this.colorPalette.slice(0, this.numColors);
        
        // Create bottles with mixed colors
        let colorArray = [];
        for (let i = 0; i < this.numColors; i++) {
            for (let j = 0; j < this.bottleCapacity; j++) {
                colorArray.push(i);
            }
        }
        
        // Shuffle colors
        colorArray = this.shuffleArray(colorArray);
        
        // Create filled bottles
        for (let i = 0; i < this.numColors; i++) {
            const bottle = [];
            for (let j = 0; j < this.bottleCapacity; j++) {
                bottle.push(colorArray.pop());
            }
            this.bottles.push(bottle);
        }
        
        // Add empty bottles
        for (let i = 0; i < this.numBottles - this.numColors; i++) {
            this.bottles.push([]);
        }
        
        this.selectedBottle = null;
        this.updateDisplay();
    }
    
    shuffleArray(arr) {
        const shuffled = [...arr];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
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
        
        // From bottle must have liquid
        if (fromBottle.length === 0) {
            this.selectedBottle = null;
            this.render();
            return;
        }
        
        // To bottle must have space
        if (toBottle.length >= this.bottleCapacity) {
            this.selectedBottle = null;
            this.render();
            this.playSound('error');
            this.showToast('Bottle is full!', 'error');
            return;
        }
        
        // Colors must match or to bottle must be empty
        if (toBottle.length > 0 && toBottle[toBottle.length - 1] !== fromBottle[fromBottle.length - 1]) {
            this.selectedBottle = null;
            this.render();
            this.playSound('error');
            this.showToast('Colors don\'t match!', 'error');
            return;
        }
        
        // Save to history before move
        this.moveHistory.push({
            from: fromIndex,
            to: toIndex,
            bottles: this.bottles.map(b => [...b])
        });
        
        // Pour same color liquids
        const color = fromBottle[fromBottle.length - 1];
        const maxPour = this.bottleCapacity - toBottle.length;
        
        let poured = 0;
        while (poured < maxPour && fromBottle.length > 0 && fromBottle[fromBottle.length - 1] === color) {
            toBottle.push(fromBottle.pop());
            poured++;
        }
        
        this.moves++;
        this.selectedBottle = null;
        
        this.playSound('pour');
        this.render();
        
        // Check if puzzle is solved
        if (this.checkWin()) {
            this.gameWon();
        }
    }
    
    checkWin() {
        for (let bottle of this.bottles) {
            // Empty bottles are okay
            if (bottle.length === 0) continue;
            
            // Full bottles with single color are okay
            if (bottle.length === this.bottleCapacity) {
                const firstColor = bottle[0];
                if (bottle.every(color => color === firstColor)) {
                    continue;
                }
            }
            
            // Any other state is not solved
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
        this.startGame();
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

        // Count sorted bottles
        let sorted = 0;
        for (let bottle of this.bottles) {
            if (bottle.length === 0) continue; // Empty is not "sorted"
            if (bottle.length === this.bottleCapacity) {
                const firstColor = bottle[0];
                if (bottle.every(color => color === firstColor)) {
                    sorted++;
                }
            }
        }

        if (sortedEl) sortedEl.textContent = sorted;
    }
    
    render() {
        const grid = document.getElementById('bottles-grid');
        if (!grid) return;
        grid.innerHTML = '';
        
        this.bottles.forEach((bottle, index) => {
            const bottleElement = document.createElement('div');
            bottleElement.className = 'bottle';
            
            if (this.selectedBottle === index) {
                bottleElement.classList.add('selected');
            }
            
            // Check if bottle is sorted
            if (bottle.length === this.bottleCapacity) {
                const firstColor = bottle[0];
                if (bottle.every(color => color === firstColor)) {
                    bottleElement.classList.add('locked');
                }
            }
            
            // Add layers
            const layersDiv = document.createElement('div');
            layersDiv.className = 'bottle-layers';
            
            for (let i = 0; i < this.bottleCapacity; i++) {
                const layer = document.createElement('div');
                layer.className = 'bottle-layer';
                
                if (i < bottle.length) {
                    layer.classList.add(this.colors[bottle[i]].class);
                }
                
                layersDiv.appendChild(layer);
            }
            
            bottleElement.appendChild(layersDiv);
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
