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
        // True while a pour animation is in flight; blocks input and prevents
        // overlapping pours from corrupting state.
        this.animating = false;

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
        if (this.animating) return;

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
    
    async pourBottle(fromIndex, toIndex) {
        if (this.animating) return;

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

        // Plan the pour without mutating state — we need the count up front to
        // drive the animation. Mirrors the loop below; stops on the first
        // would-be-revealed layer.
        const colorIdx = fromBottle[fromBottle.length - 1];
        const maxPour = this.bottleCapacity - toBottle.length;
        const seen = this.revealed[fromIndex];
        let pourCount = 0;
        let revealNext = false;
        {
            let srcLen = fromBottle.length;
            while (pourCount < maxPour && srcLen > 0 && fromBottle[srcLen - 1] === colorIdx) {
                pourCount++;
                srcLen--;
                if (srcLen > 0 && !seen.has(srcLen - 1)) {
                    revealNext = true;
                    break;
                }
            }
        }

        if (pourCount === 0) {
            this.selectedBottle = null;
            this.render();
            return;
        }

        this.animating = true;
        this.selectedBottle = null;

        await this.animatePour(fromIndex, toIndex, pourCount, colorIdx);

        this.moveHistory.push({
            from: fromIndex,
            to: toIndex,
            bottles: this.bottles.map(b => [...b]),
            revealed: this.revealed.map(s => [...s])
        });

        for (let p = 0; p < pourCount; p++) {
            toBottle.push(fromBottle.pop());
        }
        if (revealNext && fromBottle.length > 0) {
            seen.add(fromBottle.length - 1);
        }

        this.moves++;
        this.animating = false;
        this.render();

        if (this.checkWin()) {
            this.gameWon();
        }
    }

    async animatePour(fromIndex, toIndex, pourCount, colorIdx) {
        const grid = document.getElementById('bottles-grid');
        if (!grid) return;
        const bottleEls = grid.querySelectorAll('.bottle');
        const source = bottleEls[fromIndex];
        const target = bottleEls[toIndex];
        if (!source || !target) return;

        // The previously-selected glow on the source would compete with the
        // pouring transform — strip it before we move.
        source.classList.remove('selected');
        grid.classList.add('animating');

        const srcRect = source.getBoundingClientRect();
        const tgtRect = target.getBoundingClientRect();
        const gridRect = grid.getBoundingClientRect();
        const h = srcRect.height;

        // Tilt direction: lean toward the target so the spout overhangs it.
        const sourceOnLeft = (srcRect.left + srcRect.width / 2) < (tgtRect.left + tgtRect.width / 2);
        const dir = sourceOnLeft ? 1 : -1;
        const tiltDeg = dir * 70;
        const tiltRad = 70 * Math.PI / 180;

        // After a rotation of ±70° around the bottle's bottom-center, the top
        // of the bottle sits h*sin(70°) ≈ 0.94h to the side and h*(1-cos(70°))
        // ≈ 0.66h above the base. Position the source so that overhang lands
        // just above the target's opening.
        const srcCx = srcRect.left + srcRect.width / 2;
        const tgtCx = tgtRect.left + tgtRect.width / 2;
        const dx = (tgtCx - srcCx) - dir * h * Math.sin(tiltRad) * 0.85;
        const dy = (tgtRect.top - srcRect.top) - h * (1 - Math.cos(tiltRad)) - tgtRect.height * 0.05;

        source.style.transformOrigin = '50% 100%';
        source.style.transform = `translate(${dx}px, ${dy}px) rotate(${tiltDeg}deg)`;
        source.style.zIndex = '100';
        source.classList.add('pouring-source');
        target.classList.add('pouring-target');

        // Wait for the existing .bottle transform transition (0.3s) to finish.
        await this.wait(360);

        // Compute the spout and opening positions in grid-local coordinates so
        // the SVG path can render against the grid's box.
        const srcRectAfter = source.getBoundingClientRect();
        const tgtRectAfter = target.getBoundingClientRect();
        const spoutX = srcRectAfter.left + srcRectAfter.width / 2 + dir * srcRectAfter.width * 0.34 - gridRect.left;
        const spoutY = srcRectAfter.top + srcRectAfter.height * 0.16 - gridRect.top;
        const openX = tgtRectAfter.left + tgtRectAfter.width / 2 - gridRect.left;
        const openY = tgtRectAfter.top + tgtRectAfter.height * 0.1 - gridRect.top;

        const svgNS = 'http://www.w3.org/2000/svg';
        const overlay = document.createElement('div');
        overlay.className = 'pour-stream-overlay';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${gridRect.width} ${gridRect.height}`);
        svg.setAttribute('preserveAspectRatio', 'none');
        const path = document.createElementNS(svgNS, 'path');
        // Cubic Bezier: control points pull the arc downward like a real stream.
        const arcDrop = Math.max(30, Math.abs(openX - spoutX) * 0.25);
        const midY = Math.max(spoutY, openY) + arcDrop;
        const cp1x = spoutX + dir * 8;
        const cp1y = spoutY + 18;
        const cp2x = openX - dir * 8;
        const cp2y = midY;
        path.setAttribute('d', `M ${spoutX} ${spoutY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${openX} ${openY}`);
        path.setAttribute('class', `pour-stream-path ${this.colors[colorIdx].class}`);
        svg.appendChild(path);
        overlay.appendChild(svg);
        overlay.style.zIndex = '150';
        grid.appendChild(overlay);

        this.playSound('pour');

        // Stagger the layer drain/fill so the liquid appears to move one slot
        // at a time rather than vanishing/appearing all at once.
        const fromBottle = this.bottles[fromIndex];
        const toBottle = this.bottles[toIndex];
        const sourceFaceLayers = source.querySelectorAll('.face-layers');
        const targetFaceLayers = target.querySelectorAll('.face-layers');
        const colorClass = this.colors[colorIdx].class;
        const layerStep = 130;

        for (let i = 0; i < pourCount; i++) {
            const srcLayerIdx = fromBottle.length - 1 - i;
            const tgtLayerIdx = toBottle.length + i;
            setTimeout(() => {
                sourceFaceLayers.forEach(fl => {
                    const layer = fl.children[srcLayerIdx];
                    if (layer) layer.classList.add('draining');
                });
                targetFaceLayers.forEach(fl => {
                    const layer = fl.children[tgtLayerIdx];
                    if (layer) layer.classList.add('incoming', 'filled', colorClass);
                });
            }, i * layerStep);
        }

        await this.wait(pourCount * layerStep + 320);

        // Stream fades, then bottle untilts.
        path.classList.add('fading');
        await this.wait(180);

        source.style.transform = '';
        source.classList.remove('pouring-source');
        target.classList.remove('pouring-target');

        await this.wait(340);

        overlay.remove();
        source.style.transformOrigin = '';
        source.style.zIndex = '';
        grid.classList.remove('animating');
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
        if (this.animating) return;
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
        if (this.animating) return;
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

        // Build the bottle SVGs once; subsequent renders just toggle classes
        // and update the surface sheen/hidden marks. Full rebuild only when the
        // bottle count changes (level transition).
        if (!this._bottleEls || this._bottleEls.length !== this.bottles.length) {
            this._rebuildBottleDom();
        }

        for (let i = 0; i < this.bottles.length; i++) {
            this._updateBottle(i);
        }

        this.updateDisplay();
    }

    _rebuildBottleDom() {
        const grid = document.getElementById('bottles-grid');
        grid.innerHTML = '';
        this._bottleEls = [];
        this._bottleRefs = [];

        // Open cylindrical jar viewed slightly from above (viewBox 0 0 100 160).
        //   Outer glass: rx=38, foreshortened ry=10.5; mouth ellipse centred at
        //   y=22, base ellipse centred at y=148. Liquid fills the inner column
        //   (rx=35) from the base up. Each liquid layer is a cylinder *slice*
        //   capped by an ellipse, so colour boundaries read as curved discs —
        //   that's where the depth comes from. No 3D transforms (fast on iOS).
        const CX = 50, RX = 38, RY = 10.5;
        const RXI = 35, RYI = 9.7;
        const TOP_CY = 22, BOT_CY = 148;
        const LAYER_H = (BOT_CY - TOP_CY) / this.bottleCapacity;

        // Outer silhouette: back-top arc → right wall → front-bottom arc → left wall.
        const bodyPath =
            `M ${CX - RX} ${TOP_CY} A ${RX} ${RY} 0 0 1 ${CX + RX} ${TOP_CY}` +
            ` L ${CX + RX} ${BOT_CY} A ${RX} ${RY} 0 0 1 ${CX - RX} ${BOT_CY} Z`;

        const SVG_NS = 'http://www.w3.org/2000/svg';
        const svgEl = (tag, attrs) => {
            const el = document.createElementNS(SVG_NS, tag);
            for (const k in attrs) el.setAttribute(k, attrs[k]);
            return el;
        };

        for (let index = 0; index < this.bottles.length; index++) {
            const bottleElement = document.createElement('div');
            bottleElement.className = 'bottle';

            const svg = svgEl('svg', {
                class: 'bottle-svg',
                viewBox: '0 0 100 160',
                preserveAspectRatio: 'xMidYMid meet',
            });

            // Glass body tint behind everything.
            svg.appendChild(svgEl('path', { class: 'bottle-body-bg', d: bodyPath }));

            // Dark interior — the shadowed inside of the jar, visible wherever
            // there's no liquid (this is the default "empty" look).
            svg.appendChild(svgEl('rect', {
                class: 'bottle-interior',
                x: CX - RXI, y: TOP_CY - RYI,
                width: RXI * 2, height: (BOT_CY + RYI) - (TOP_CY - RYI),
                'clip-path': 'url(#body-clip)',
            }));

            // Liquid layers (bottom→top). Each slot is a <g> holding a curved
            // wall path plus an elliptical cap, so layer boundaries are rounded.
            const layersGroup = svgEl('g', {
                class: 'face-layers',
                'clip-path': 'url(#body-clip)',
            });
            const layerRefsByPos = [];
            for (let pos = 0; pos < this.bottleCapacity; pos++) {
                const topY = BOT_CY - (pos + 1) * LAYER_H; // surface of this slice
                const bottomY = BOT_CY - pos * LAYER_H;
                const wallPath =
                    `M ${CX - RXI} ${topY} L ${CX + RXI} ${topY}` +
                    ` L ${CX + RXI} ${bottomY}` +
                    ` A ${RXI} ${RYI} 0 0 1 ${CX - RXI} ${bottomY} Z`;
                const g = svgEl('g', { class: 'face-layer', 'data-pos': pos });
                g.appendChild(svgEl('path', {
                    class: 'layer-wall',
                    d: wallPath,
                }));
                g.appendChild(svgEl('ellipse', {
                    class: 'layer-cap', cx: CX, cy: topY, rx: RXI, ry: RYI,
                }));
                layersGroup.appendChild(g);
                layerRefsByPos.push([g]);
            }
            svg.appendChild(layersGroup);

            // Hidden-layer "?" markers — one per slot, all hidden by default.
            const hiddenGroup = svgEl('g', {
                class: 'hidden-marks',
                'clip-path': 'url(#body-clip)',
            });
            const hiddenMarksByPos = [];
            for (let pos = 0; pos < this.bottleCapacity; pos++) {
                const y = BOT_CY - pos * LAYER_H - LAYER_H / 2;
                const text = svgEl('text', {
                    class: 'hidden-mark',
                    'data-pos': pos,
                    x: CX, y: y,
                    'text-anchor': 'middle',
                    'dominant-baseline': 'central',
                });
                text.textContent = '?';
                hiddenGroup.appendChild(text);
                hiddenMarksByPos.push(text);
            }
            svg.appendChild(hiddenGroup);

            // Cylinder edge shading over the liquid — rounds the tube.
            svg.appendChild(svgEl('rect', {
                class: 'bottle-body-shade',
                x: CX - RX, y: TOP_CY - RY,
                width: RX * 2, height: (BOT_CY + RY) - (TOP_CY - RY),
                'clip-path': 'url(#body-clip)',
                'pointer-events': 'none',
            }));

            // Glossy sheen on the topmost liquid surface (JS moves it to the level).
            const sheen = svgEl('ellipse', {
                class: 'bottle-sheen',
                cx: CX, cy: TOP_CY, rx: RXI * 0.82, ry: RYI * 0.72,
                'clip-path': 'url(#body-clip)',
                'pointer-events': 'none',
            });
            svg.appendChild(sheen);

            // Open mouth — a glass lip ring drawn as a stroked ellipse so the
            // hole stays see-through (liquid surface or dark interior shows through).
            svg.appendChild(svgEl('ellipse', {
                class: 'bottle-rim',
                cx: CX, cy: TOP_CY, rx: (RX + RXI) / 2, ry: (RY + RYI) / 2,
                'pointer-events': 'none',
            }));

            // Vertical specular gloss down the front-left of the glass.
            svg.appendChild(svgEl('ellipse', {
                class: 'bottle-gloss',
                cx: CX - RX * 0.5, cy: (TOP_CY + BOT_CY) / 2,
                rx: 5.5, ry: (BOT_CY - TOP_CY) * 0.34,
                'pointer-events': 'none',
            }));

            bottleElement.appendChild(svg);

            const check = document.createElement('div');
            check.className = 'bottle-check';
            check.textContent = '✓';
            bottleElement.appendChild(check);

            bottleElement.addEventListener('click', () => this.selectBottle(index));

            grid.appendChild(bottleElement);
            this._bottleEls.push(bottleElement);
            this._bottleRefs.push({
                layerRefsByPos,
                hiddenMarksByPos,
                sheen,
                layerBotY: BOT_CY,
                layerH: LAYER_H,
            });
        }
    }

    _updateBottle(index) {
        const bottle = this.bottles[index];
        const bottleElement = this._bottleEls[index];
        const refs = this._bottleRefs[index];

        const isSealed = this.isBottleSealed(index);
        const isFull = bottle.length === this.bottleCapacity;
        const isSorted = !isSealed && isFull && bottle.every(c => c === bottle[0]);

        bottleElement.classList.toggle('selected', this.selectedBottle === index);
        bottleElement.classList.toggle('locked', isSealed);
        bottleElement.classList.toggle('sorted', isSorted);

        // Reusable list of every color class we might have applied previously,
        // so we can clean stale ones before reapplying the current color.
        if (!this._allColorClasses) {
            this._allColorClasses = this.colorPalette.map(c => c.class);
        }
        const allColors = this._allColorClasses;

        // Track the topmost visible (non-hidden) liquid layer so we can park the
        // glossy surface sheen at its level.
        let topVisiblePos = -1;

        for (let pos = 0; pos < this.bottleCapacity; pos++) {
            let colorClass = null;
            let isHidden = false;
            if (pos < bottle.length) {
                if (this.isPositionHidden(index, pos)) {
                    isHidden = true;
                } else {
                    colorClass = this.colors[bottle[pos]].class;
                    topVisiblePos = pos;
                }
            }
            for (const layer of refs.layerRefsByPos[pos]) {
                for (const c of allColors) layer.classList.remove(c);
                // Animation classes from a previous pour must be cleared too,
                // otherwise the layer would stay at scaleY(0) or animate again.
                layer.classList.remove('hidden-layer', 'filled', 'draining', 'incoming');
                if (isHidden) layer.classList.add('hidden-layer');
                if (colorClass) layer.classList.add(colorClass, 'filled');
            }
            const mark = refs.hiddenMarksByPos[pos];
            if (mark) mark.classList.toggle('active', isHidden);
        }

        // Sheen sits on the surface of the topmost visible liquid layer.
        if (refs.sheen) {
            if (topVisiblePos >= 0) {
                const topY = refs.layerBotY - (topVisiblePos + 1) * refs.layerH;
                refs.sheen.setAttribute('cy', topY);
                refs.sheen.classList.add('active');
            } else {
                refs.sheen.classList.remove('active');
            }
        }
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
