# Bottle Sort Puzzle PWA

A relaxing yet challenging bottle sorting puzzle game built as a Progressive Web App with Supabase leaderboard support.

## About the Game

**Bottle Sort** is a puzzle game where you sort colored liquids into bottles. Each bottle holds up to 4 layers of colored liquid. Your goal is to sort all bottles so each one contains only a single color.

### Game Rules
- You can only pour liquid from one bottle to another if they have matching colors or the destination bottle is empty
- Each bottle can hold up to 4 layers
- Empty bottles can receive any color
- A bottle is "solved" when it contains 4 layers of the same color
- You win when all bottles are sorted

## Features

🎮 **Gameplay**
- Relaxing puzzle mechanics
- Three difficulty levels (Easy, Normal, Hard)
- Progressive level system - each level gets more challenging
- Move counter to track efficiency
- Undo functionality to correct mistakes

📱 **PWA Features**
- Install as native app on iOS/Android
- Works offline with local storage fallback
- Service worker for caching and performance
- Responsive design for all devices
- Smooth animations and transitions

🏆 **Leaderboard**
- Track best scores globally via Supabase
- Offline score storage (syncs when online)
- Level-based scoring system
- Move-based penalties

🔧 **Customization**
- Sound effects toggle
- Three difficulty levels
- Game parameters easily configurable

## Quick Start

### 1. Setup Supabase (Optional - for online features)

1. Go to [Supabase](https://supabase.com) and create a new project
2. In your project settings, get your:
   - Project URL
   - Anon/Public API Key

3. Open `supabase-config.js` and update:
```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

### 2. Create Database Tables (in Supabase)

Run these SQL commands in the Supabase SQL editor:

```sql
-- Create scores table
CREATE TABLE scores (
    id BIGSERIAL PRIMARY KEY,
    player_name VARCHAR(255) NOT NULL,
    score INT NOT NULL,
    level INT NOT NULL,
    orders_completed INT NOT NULL,
    difficulty VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scores_player_name ON scores(player_name);
CREATE INDEX idx_scores_score ON scores(score DESC);

-- Enable Row Level Security
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Enable read access for all users" ON scores
    FOR SELECT USING (true);

-- Create policy for public insert
CREATE POLICY "Enable insert for all users" ON scores
    FOR INSERT WITH CHECK (true);
```

### 3. Play the Game

Open `index.html` in your browser or visit the deployed URL.

## Game Mechanics

### How to Play

1. **View the Board**: 5-6 bottles are displayed with mixed colored liquids
2. **Select a Bottle**: Click on a bottle to select it (it will be highlighted)
3. **Pour to Another**: Click another bottle to pour the top layer into it
4. **Match Colors**: Liquids can only be poured into bottles with matching colors or empty bottles
5. **Solve All**: Continue until every bottle has only one color
6. **Progress**: Each level adds more colors, making puzzles harder

### Scoring System
- **Base Score**: 1000 points per level
- **Level Bonus**: +100 per level (level 5 = 500 bonus)
- **Move Penalty**: -10 points per move over 20 moves
- **Example**: Level 3 with 25 moves = 1000 + 300 - 50 = 1250 points

### Difficulty Levels

| Level | Colors | Bottles | Complexity |
|-------|--------|---------|------------|
| Easy  | 3      | 4       | Beginner   |
| Normal| 4      | 5       | Intermediate |
| Hard  | 5      | 6       | Advanced   |

## File Structure

```
ordergame/
├── index.html              # Main game UI
├── style.css              # Game styling and animations
├── game.js                # Game logic and mechanics
├── supabase-config.js     # Supabase integration
├── service-worker.js      # PWA service worker
├── manifest.json          # PWA manifest
└── README.md             # This file
```

## Installation as App

### Android
1. Open the game in Chrome
2. Click the menu → "Install app" or use the install prompt
3. App will appear on home screen
4. Launch like any native app

### iOS
1. Open the game in Safari
2. Tap Share → "Add to Home Screen"
3. Name the app and tap "Add"
4. App will appear on home screen

## Features Explained

### Offline Mode
- Game works without internet connection
- Scores saved locally in browser storage (`localStorage`)
- Automatically syncs with Supabase when connection restored
- Complete gameplay experience without network

### Sound Effects
- Game provides audio feedback for:
  - Bottle selection
  - Successful pours
  - Errors and invalid moves
  - Level completion
- Toggle in Settings
- Uses Web Audio API for audio generation

### Undo System
- Undo button reverts last move
- Keeps move counter accurate
- Can undo multiple times
- Move history persists during game session

### Hint System
- Provides gameplay hints
- Encourages strategic thinking
- Available anytime during gameplay

## Configuration

### Game Parameters

Edit in `game.js` constructor:

```javascript
this.bottleCapacity = 4;      // Layers per bottle
this.numBottles = 5;          // Total bottles (depends on difficulty)
this.numColors = 4;           // Colors to sort (depends on difficulty)
```

### Available Colors
The game supports 8 different colors:
- Red, Blue, Green, Yellow
- Purple, Orange, Pink, Cyan

You can add more colors by extending the `colorPalette` array.

## Troubleshooting

### Supabase Connection Issues
- Check that SUPABASE_URL and SUPABASE_ANON_KEY are correct
- Verify RLS policies allow read/write
- Check browser console for specific errors
- Scores will save locally if offline

### Service Worker Not Updating
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache
- Check DevTools > Application > Service Workers

### Scores Not Saving
- Verify internet connection for Supabase
- Check browser console for errors
- Scores automatically save to localStorage as backup
- Check browser's storage settings

## Browser Support

- Chrome/Edge 51+
- Firefox 44+
- Safari 11+
- Opera 38+

## Development

### Debugging
- Open browser console (F12) for logs
- Service Worker status: DevTools > Application > Service Workers
- Cached files: DevTools > Application > Cache Storage
- Local storage: DevTools > Application > Local Storage

### Making Changes
1. Edit HTML/CSS/JS files
2. Hard refresh browser (Ctrl+Shift+R)
3. Service Worker will update on next visit

## Performance

- Lightweight with no heavy dependencies
- Optimized for mobile devices
- Efficient caching strategy
- Fast Service Worker loading
- Minimal memory footprint

## Future Improvements

- [ ] Cloud save system
- [ ] Daily challenges
- [ ] Achievements and badges
- [ ] Different game themes/skins
- [ ] Multiplayer competitive mode
- [ ] Custom difficulty settings
- [ ] Replay system
- [ ] Social sharing integration
- [ ] Analytics dashboard

## License

This project is open source. Feel free to use and modify for your purposes.

## Support

For issues or questions:
1. Check the browser console (F12) for error messages
2. Ensure Supabase configuration is correct
3. Try clearing browser cache and reloading
4. Check that localStorage is enabled in browser

---

**Enjoy sorting! 🧴**

