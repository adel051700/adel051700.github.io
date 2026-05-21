// Supabase Configuration (Temporary Dev Keys)
// TODO: Replace these with your actual Supabase project credentials
// Get these from: https://app.supabase.com/project/[your-project]/settings/api

const SUPABASE_URL = 'https://wjanlxrvhnwgmnbitmlh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_8xSdEyiPW8TZuqvkJP9FxQ_gfWP04iG';

// Table names
const TABLES = {
    SCORES: 'scores',
    PLAYERS: 'players'
};

// Initialize Supabase client
class SupabaseClient {
    constructor(url, publishableKey) {
        this.url = url;
        this.publishableKey = publishableKey;
    }

    // POST request
    async post(table, data) {
        try {
            const response = await fetch(`${this.url}/rest/v1/${table}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.publishableKey,
                    'Authorization': `Bearer ${this.publishableKey}`,
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Supabase POST error:', error);
            return null;
        }
    }

    // GET request
    async get(table, options = {}) {
        try {
            let query = `${this.url}/rest/v1/${table}?`;

            // Add filters
            if (options.filter) {
                query += `${options.filter}&`;
            }

            // Add ordering
            if (options.order) {
                query += `order=${options.order}&`;
            }

            // Add limit
            if (options.limit) {
                query += `limit=${options.limit}&`;
            }

            query += `select=*`;

            const response = await fetch(query, {
                method: 'GET',
                headers: {
                    'apikey': this.publishableKey,
                    'Authorization': `Bearer ${this.publishableKey}`,
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Supabase GET error:', error);
            return [];
        }
    }

    // UPDATE request
    async update(table, data, filter) {
        try {
            const response = await fetch(`${this.url}/rest/v1/${table}?${filter}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.publishableKey,
                    'Authorization': `Bearer ${this.publishableKey}`,
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Supabase UPDATE error:', error);
            return null;
        }
    }

    // Upsert (insert or update)
    async upsert(table, data, conflictColumn) {
        try {
            const response = await fetch(`${this.url}/rest/v1/${table}?on_conflict=${conflictColumn}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.publishableKey,
                    'Authorization': `Bearer ${this.publishableKey}`,
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Supabase UPSERT error:', error);
            return null;
        }
    }
}

// Create global Supabase instance
const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Supabase utility functions
const SupabaseUtils = {
    // Save a score to the database
    async saveScore(playerName, score, level, ordersCompleted) {
        return await supabase.post(TABLES.SCORES, {
            player_name: playerName,
            score: score,
            level: level,
            orders_completed: ordersCompleted,
            created_at: new Date().toISOString(),
            difficulty: localStorage.getItem('difficulty') || 'normal'
        });
    },

    // Get top scores
    async getTopScores(limit = 10) {
        return await supabase.get(TABLES.SCORES, {
            order: 'score.desc',
            limit: limit
        });
    },

    // Get player's best score
    async getPlayerBestScore(playerName) {
        const scores = await supabase.get(TABLES.SCORES, {
            filter: `player_name=eq.${encodeURIComponent(playerName)}`,
            order: 'score.desc',
            limit: 1
        });
        return scores.length > 0 ? scores[0] : null;
    },

    // Initialize tables (run once to set up the schema)
    async initializeTables() {
        console.log('Tables schema should be created in Supabase:');
        console.log(`
        -- scores table
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
        
        -- Enable RLS if needed
        ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
        
        -- Allow public read/write for now (dev mode)
        CREATE POLICY "Enable read access for all users" ON scores
            FOR SELECT USING (true);
        
        CREATE POLICY "Enable insert for all users" ON scores
            FOR INSERT WITH CHECK (true);
        `);
    }
};

// Check if we're online
function isOnline() {
    return navigator.onLine;
}

// Local storage fallback for offline mode
const LocalStorageDB = {
    saveScore(playerName, score, level, ordersCompleted) {
        const scores = JSON.parse(localStorage.getItem('offlineScores') || '[]');
        scores.push({
            player_name: playerName,
            score: score,
            level: level,
            orders_completed: ordersCompleted,
            created_at: new Date().toISOString(),
            difficulty: localStorage.getItem('difficulty') || 'normal'
        });
        localStorage.setItem('offlineScores', JSON.stringify(scores));
        return Promise.resolve({ id: scores.length });
    },

    getTopScores(limit = 10) {
        const scores = JSON.parse(localStorage.getItem('offlineScores') || '[]');
        return Promise.resolve(scores.sort((a, b) => b.score - a.score).slice(0, limit));
    }
};

// Combined API that uses Supabase or local storage
const GameDB = {
    async saveScore(playerName, score, level, ordersCompleted) {
        if (isOnline()) {
            return await SupabaseUtils.saveScore(playerName, score, level, ordersCompleted);
        } else {
            return await LocalStorageDB.saveScore(playerName, score, level, ordersCompleted);
        }
    },

    async getTopScores(limit = 10) {
        if (isOnline()) {
            return await SupabaseUtils.getTopScores(limit);
        } else {
            return await LocalStorageDB.getTopScores(limit);
        }
    }
};
