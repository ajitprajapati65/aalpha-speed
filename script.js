// --- 1. DATA POOLS ---
const textPools = {
    confidence: ["ask", "dad", "fall", "glad", "flash", "glass", "half", "sad", "all", "falls", "dash", "lass", "flag", "had", "hall", "salad"],
    easy: ["The cat sat on the mat.", "A quick brown fox jumps.", "She likes to read books.", "Water is good for health.", "Look at the blue sky.", "He ran fast to win.", "Sun shines bright today."],
    medium1: ["In 2026, technology is everywhere.", "Can you type at 60 WPM?", "Practice makes a man perfect.", "Always keep your eyes on the screen."],
    medium2: ["Focus on accuracy before speed.", "Numbers like 100 or 500 are easy.", "Don't look at your keyboard.", "Typing is a great skill to learn in 2026."],
    hard: ["The Industrial Revolution (1760-1840) changed everything!", "Email me at user_name@domain.com.", "He said, \"What a beautiful day!\"", "Item #45 costs $99.99."],
    extreme: ["The appLi company definately wants you to beleive.", "Is this technollogy succesfull?", "You must definately beleive in appLi."]
};

function generateWords(pool, targetWordCount) {
    let words = [];
    while (words.length < targetWordCount) {
        let sentence = pool[Math.floor(Math.random() * pool.length)];
        words.push(...sentence.split(' '));
    }
    return words.slice(0, targetWordCount).join(' ');
}

const lessons = [];
for (let i = 1; i <= 30; i++) {
    let tier, tierClass, targetWords, pool, isInfinite = false, desc;
    if (i <= 5) { tier = "Keyboard Confidence"; tierClass = "tier-confidence"; targetWords = 80; pool = textPools.confidence; desc = "Home row realistic words."; }
    else if (i <= 10) { tier = "Easy Paragraph"; tierClass = "tier-easy"; targetWords = 150; pool = textPools.easy; isInfinite = true; desc = "Infinite typing mode!"; }
    else if (i <= 15) { tier = "Medium Level 1"; tierClass = "tier-medium"; targetWords = 220; pool = textPools.medium1; desc = "Longer sentences."; }
    else if (i <= 20) { tier = "Medium Level 2"; tierClass = "tier-medium"; targetWords = 300; pool = textPools.medium2; desc = "Numbers and punctuation."; }
    else if (i <= 25) { tier = "Hard Level"; tierClass = "tier-hard"; targetWords = 400; pool = textPools.hard; desc = "Complex symbols."; }
    else { tier = "Extreme Level"; tierClass = "tier-extreme"; targetWords = 500; pool = textPools.extreme; desc = "Tricky spellings."; }
    lessons.push({ id: i, tier, tierClass, targetWords, pool, isInfinite, desc });
}

// --- 2. APP OBJECT ---
const app = {
    user: null,
    progress: { bestWPM: 0, bestAcc: 0, completedLessons: [], streak: 0 }, // NEW: Added completedLessons and streak
    currentLessonId: null,
    textArray: [],
    charIndex: 0,
    timer: null,
    maxTime: 60,
    timeLeft: 60,
    timeElapsed: 0,
    isTyping: false,
    stats: { totalTyped: 0, correctChars: 0, mistakes: 0 },
    
    // NEW: Native Audio Engine for zero-dependency sounds
    audio: {
        ctx: null,
        init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
        playTone(freq, type, duration, vol) {
            if (!this.ctx) return;
            if (this.ctx.state === 'suspended') this.ctx.resume();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gain.gain.setValueAtTime(vol, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        },
        playClick() { this.playTone(600, 'sine', 0.05, 0.05); }, // Light keypress
        playError() { this.playTone(150, 'sawtooth', 0.15, 0.1); } // Deeper error buzz
    },

    init() {
        // NEW: Load user and extended progress from LocalStorage
        const storedProg = localStorage.getItem('aalpha_progress');
        const storedUser = localStorage.getItem('aalpha_user');
        
        if (storedProg) {
            this.progress = { ...this.progress, ...JSON.parse(storedProg) };
        }
        if (storedUser) {
            this.user = JSON.parse(storedUser);
        }
        
        if(localStorage.getItem('aalpha_theme') === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
        
        this.setupEventListeners();

        // NEW: Auto-login bypass
        if (this.user) {
            this.showDashboard();
        } else {
            this.switchView('login-view');
        }
    },

    saveProgress() {
        // NEW: Helper to save progress
        localStorage.setItem('aalpha_progress', JSON.stringify(this.progress));
    },

    setupEventListeners() {
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const fname = document.getElementById('fname').value.trim();
            const lname = document.getElementById('lname').value.trim();
            if (fname && lname) {
                this.user = { fname, lname, fullName: `${fname} ${lname}` };
                localStorage.setItem('aalpha_user', JSON.stringify(this.user));
                this.audio.init(); 
                this.showDashboard();
            }
        });

        const inputEl = document.getElementById('hidden-input');

        // 1. DESKTOP LOGIC
        inputEl.addEventListener('keydown', (e) => {
            // --- ZOMBIE GAME BYPASS ---
            if (document.getElementById('zombie-view').classList.contains('active')) {
                return; // Let the 'input' listener handle word-typing for the game
            }
            // --------------------------

            if (!this.isTyping && this.charIndex === 0 && e.key.length === 1 && e.key !== 'Unidentified') {
                this.audio.init(); 
                this.startTimer();
            }
            this.handleKeystroke(e);
        });

        // 2. MOBILE & ZOMBIE LOGIC
        inputEl.addEventListener('input', (e) => {
            // --- ZOMBIE GAME ROUTING ---
            if (document.getElementById('zombie-view').classList.contains('active')) {
                zombieGame.handleWordInput(e);
                return; // Stop the standard app from clearing the input field!
            }
            // ---------------------------

            if (e.inputType === 'deleteContentBackward') {
                this.handleKeystroke({ key: 'Backspace', preventDefault: () => {} });
            } 
            else if (e.data) {
                if (!this.isTyping && this.charIndex === 0) {
                    this.audio.init(); 
                    this.startTimer();
                }
                const chars = e.data.split('');
                chars.forEach(char => {
                    this.handleKeystroke({ key: char, preventDefault: () => {} });
                });
            }
            inputEl.value = ''; // Clear only for the standard typing test
        });

        const customTimerEl = document.getElementById('custom-timer');
        customTimerEl.addEventListener('input', () => {
            if (document.getElementById('timer-select').value === 'custom') {
                this.handleTimerSelection();
            }
        });

        // --- NEW: ZOMBIE GAME FOCUS FIX ---
        // Keeps the hidden input focused when clicking the grass area
        const zombieArea = document.getElementById('zombie-game-area');
        if (zombieArea) {
            zombieArea.addEventListener('click', () => {
                inputEl.focus();
            });
        }
    },

    switchView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        if(this.user) {
            document.getElementById('nav-user-name').textContent = this.user.fullName;
            document.getElementById('nav-user-name').style.display = 'block';
            document.getElementById('nav-dashboard-btn').style.display = viewId === 'dashboard-view' ? 'none' : 'block';
        }
    },

    toggleTheme() {
        const root = document.documentElement;
        const newTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', newTheme);
        localStorage.setItem('aalpha_theme', newTheme);
    },

    showDashboard() {
        this.switchView('dashboard-view');
        const grid = document.getElementById('lessons-grid');
        grid.innerHTML = '';
        lessons.forEach(lesson => {
            // NEW: Added visual ✅ indicator for completed lessons
            const isCompleted = this.progress.completedLessons.includes(lesson.id);
            const statusIcon = isCompleted ? ' ✅' : '';
            
            const div = document.createElement('div');
            div.className = `lesson-card glass`;
            div.innerHTML = `
                <div class="tier ${lesson.tierClass}">${lesson.tier}</div>
                <h3>Lesson ${lesson.id}${statusIcon}</h3>
                <div style="font-size:0.8rem;color:var(--text-muted)">${lesson.targetWords} Words</div>
            `;
            div.onclick = () => this.loadLesson(lesson.id);
            grid.appendChild(div);
        });
    },

    loadLesson(id) {
        this.currentLessonId = id;
        const lesson = lessons[id - 1];
        this.switchView('typing-view');
        document.getElementById('current-lesson-title').textContent = `Lesson ${lesson.id}: ${lesson.tier}`;
        document.getElementById('current-lesson-desc').textContent = lesson.desc;
        this.handleTimerSelection();
        this.resetStats();
        this.textArray = generateWords(lesson.pool, lesson.targetWords).split('');
        this.renderInitialText();
        
        // FIX: Ensure focus happens, then immediately reset the scroll container 
        // to override the browser's default jump-to-focus behavior.
        setTimeout(() => {
            document.getElementById('hidden-input').focus();
            
            // Force container back to top after DOM paint & focus
            const scrollContainer = document.getElementById('scroll-container');
            if (scrollContainer) {
                scrollContainer.scrollTop = 0;
            }
            
            // Optional: If you prefer it to perfectly lock onto the first character
            this.scrollToActive(); 
        }, 100);
    },

    renderInitialText() {
        const container = document.getElementById('typing-text');
        container.innerHTML = '';
        const fragment = document.createDocumentFragment();
        this.textArray.forEach((char, index) => {
            const span = document.createElement('span');
            span.innerText = char;
            span.className = 'char' + (index === 0 ? ' active' : '');
            fragment.appendChild(span);
        });
        container.appendChild(fragment);
    },
    // NEW: Robust helper function to parse user input into seconds
    parseCustomTime(input) {
        if (!input) return 60; // Fallback to 60s if input is completely empty
        
        let value = input.trim().toLowerCase();
        let seconds = 60; // Default fallback
        
        if (value.endsWith('s')) {
            // Handle explicit seconds (e.g., "60s", "90s")
            let secs = parseFloat(value.replace('s', ''));
            if (!isNaN(secs)) {
                seconds = Math.round(secs);
            }
        } else if (value.endsWith('m')) {
            // Handle explicit minutes (e.g., "1.5m", "2m")
            let mins = parseFloat(value.replace('m', ''));
            if (!isNaN(mins)) {
                seconds = Math.round(mins * 60);
            }
        } else {
            // Handle default (no suffix) -> Treat as MINUTES (e.g., "5" becomes 300s)
            let mins = parseFloat(value);
            if (!isNaN(mins)) {
                seconds = Math.round(mins * 60);
            }
        }
        
        // Clamp the final value for safety: Minimum 10s, Maximum 600s (10 mins)
        return Math.min(Math.max(seconds, 10), 600);
    },
    // NEW: Time ko MM:SS format mein dikhane ke liye helper function
    formatTime(totalSeconds) {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        // Agar 1 minute se kam hai toh "0:45", warna "1:30" dikhayega
        return `${m}:${s.toString().padStart(2, '0')}`;
    },

    // UPDATED: Timer selection handler
    handleTimerSelection() {
        const select = document.getElementById('timer-select');
        const customInput = document.getElementById('custom-timer');
        
        if (select.value === 'custom') {
            customInput.style.display = 'inline-block';
            this.maxTime = this.parseCustomTime(customInput.value);
        } else {
            customInput.style.display = 'none';
            this.maxTime = parseInt(select.value, 10);
        }

        this.timeLeft = this.maxTime;
        // FIX: Display time using formatTime()
        document.getElementById('live-time').textContent = this.maxTime === 0 ? '∞' : this.formatTime(this.timeLeft);
        this.resetStats();
    },

    startTimer() {
        if (this.isTyping) return;
        this.isTyping = true;
        this.timer = setInterval(() => {
            this.timeElapsed++;
            
            if (this.maxTime > 0) {
                this.timeLeft--;
                // FIX: Update countdown with formatTime()
                document.getElementById('live-time').textContent = this.formatTime(this.timeLeft);
                if (this.timeLeft <= 0) {
                    this.endLesson();
                    return;
                }
            } else {
                // FIX: Update infinite mode with formatTime()
                document.getElementById('live-time').textContent = this.formatTime(this.timeElapsed);
            }
            
            const mins = this.timeElapsed / 60;
            const liveWpm = mins > 0 ? Math.round((this.stats.totalTyped / 5) / mins) : 0;
            document.getElementById('live-wpm').textContent = liveWpm;
        }, 1000);
    },

    handleKeystroke(e) {
        if (e.key === 'Backspace') {
            if (this.charIndex > 0) {
                const spans = document.getElementById('typing-text').childNodes;
                spans[this.charIndex].classList.remove('active');
                this.charIndex--;
                
                const prevChar = spans[this.charIndex];
                
                if (prevChar.classList.contains('correct')) {
                    this.stats.correctChars--;
                    this.stats.totalTyped--;
                } else if (prevChar.classList.contains('wrong')) {
                    this.stats.mistakes--;
                    this.stats.totalTyped--;
                }
                
                prevChar.className = 'char active';
                this.scrollToActive();
                this.audio.playClick(); // Play light sound for backspace too
            }
            return;
        }

        if (e.key.length !== 1) return;

        e.preventDefault();
        const spans = document.getElementById('typing-text').childNodes;
        const typed = e.key;
        const expected = this.textArray[this.charIndex];
        
        this.stats.totalTyped++;

        if (typed === expected) {
            spans[this.charIndex].classList.add('correct');
            this.stats.correctChars++;
            this.audio.playClick(); // NEW: Success sound
        } else {
            spans[this.charIndex].classList.add('wrong');
            this.stats.mistakes++;
            this.audio.playError(); // NEW: Error sound
        }

        spans[this.charIndex].classList.remove('active');
        this.charIndex++;

        if (this.charIndex < this.textArray.length) {
            spans[this.charIndex].classList.add('active');
            this.scrollToActive();
        } else {
            this.endLesson();
        }
    },

    scrollToActive() {
        const active = document.querySelector('.char.active');
        if (!active) return;

        const container = document.getElementById('scroll-container');
        
        // Active character ki top se exact position
        const activeTop = active.offsetTop;
        
        // Container ki height ka lagbhag 1/3rd hissa (Best visual position)
        const offsetPosition = container.clientHeight / 3; 

        // Ekdum Simple Math: 
        // Agar cursor thoda neeche aa gaya hai, toh usko offset par lock kar do.
        // Isse same line par type/backspace karne par JS exactly same value set karega,
        // Jiska matlab screen bilkul nahi hilegi!
        if (activeTop > offsetPosition) {
            container.scrollTop = activeTop - offsetPosition;
        } else {
            // Shuruwat ki 1-2 lines ke liye scroll top par hi rahega
            container.scrollTop = 0;
        }
    },

    resetStats() {
        clearInterval(this.timer);
        this.isTyping = false;
        this.charIndex = 0;
        this.timeElapsed = 0;
        this.timeLeft = this.maxTime;
        this.stats = { totalTyped: 0, correctChars: 0, mistakes: 0 };
        // FIX: Reset hone par bhi formatted time dikhaye
        document.getElementById('live-time').textContent = this.maxTime === 0 ? '∞' : this.formatTime(this.timeLeft);
        document.getElementById('live-wpm').textContent = '0';
        document.getElementById('hidden-input').value = '';
        document.getElementById('scroll-container').scrollTop = 0;
    },

    resetLesson() { 
        this.loadLesson(this.currentLessonId); 
    },

    endLesson() {
        clearInterval(this.timer);
        this.isTyping = false;
        
        const mins = Math.max(this.timeElapsed, 1) / 60;
        const gross = Math.round((this.stats.totalTyped / 5) / mins) || 0;
        const net = Math.max(0, Math.round(gross - (this.stats.mistakes / mins)));
        const acc = this.stats.totalTyped > 0 ? Math.round((this.stats.correctChars / this.stats.totalTyped) * 100) : 0;
        
        this.showResults(net, gross, acc);
    },

    showResults(net, gross, acc) {
        this.switchView('result-view');
        
        // --- NEW: Performance Feedback & Streak Logic ---
        let feedbackMessage = "";
        
        // Streak calculations
        if (acc >= 90) {
            this.progress.streak++;
        } else {
            this.progress.streak = 0;
        }

        // Improvement calculations
        if (net > this.progress.bestWPM && this.progress.bestWPM > 0) {
            feedbackMessage = "🚀 Amazing! New Personal Best Speed!";
        } else if (acc > this.progress.bestAcc && this.progress.bestAcc > 0) {
            feedbackMessage = "🎯 Awesome! New Personal Best Accuracy!";
        } else if (acc >= 90) {
            feedbackMessage = "🔥 Solid performance! Keep it up.";
        } else {
            feedbackMessage = "Keep practicing, you'll improve! 💪";
        }

        // Save records
        if (net > this.progress.bestWPM) this.progress.bestWPM = net;
        if (acc > this.progress.bestAcc) this.progress.bestAcc = acc;
        
        // Save completed lesson (if passed with decent accuracy)
        if (acc >= 75 && !this.progress.completedLessons.includes(this.currentLessonId)) {
            this.progress.completedLessons.push(this.currentLessonId);
        }
        
        this.saveProgress();
        // ----------------------------------------------

        // Inject dynamic feedback into UI
        const streakText = this.progress.streak > 1 ? ` | Streak: ${this.progress.streak}🔥` : '';
        document.getElementById('result-greeting').innerHTML = `
            Great Job, ${this.user.fname}!
            <div style="font-size: 1.1rem; color: var(--primary); margin-top: 0.5rem; font-weight: 500;">
                ${feedbackMessage}${streakText}
            </div>
        `;

        document.getElementById('res-net-wpm').textContent = net;
        document.getElementById('res-gross-wpm').textContent = gross;
        document.getElementById('res-acc').textContent = acc + '%';
        document.getElementById('res-total-chars').textContent = this.stats.totalTyped;
        document.getElementById('res-correct-chars').textContent = this.stats.correctChars;
        document.getElementById('res-mistakes').textContent = this.stats.mistakes;
        // showResults ke andar is line ko badal do:
        document.getElementById('res-time').textContent = this.formatTime(this.timeElapsed);
        
        const badge = document.getElementById('rating-badge');
        badge.textContent = acc >= 90 ? "Excellent 🔥" : acc >= 75 ? "Good 🟢" : "Practice Needed 🔴";
        badge.style.background = acc >= 90 ? "var(--correct)" : acc >= 75 ? "var(--primary)" : "var(--wrong)";
    },

    nextLesson() { 
        if (this.currentLessonId < 30) this.loadLesson(this.currentLessonId + 1); 
    }
};

window.onload = () => app.init();





// --- 3. ZOMBIE SURVIVAL GAME ENGINE ---
const zombieGame = {
    isActive: false,
    health: 3,
    score: 0,
    startTime: 0,
    totalCharsTyped: 0,
    zombies: [],
    currentInput: "",
    gameLoopId: null,
    spawnInterval: null,
    area: null,
    
    // Words extracted and flattened from your existing text pools
    wordPool: textPools.confidence.concat(
        textPools.easy.join(" ").split(" ").map(w => w.replace(/[^a-zA-Z]/g, "").toLowerCase())
    ).filter(w => w.length > 2), // Keep words longer than 2 chars

    init() {
        this.isActive = true;
        this.health = 3;
        this.score = 0;
        this.totalCharsTyped = 0;
        this.zombies = [];
        this.currentInput = "";
        this.startTime = Date.now();
        this.area = document.getElementById('zombie-game-area');
        
        this.area.innerHTML = `
            <div id="player-base">🛡️ Base</div>
            <div id="z-current-typing"></div>
        `; // Reset area
        
        this.updateUI();
        document.getElementById('hidden-input').focus();
        
        // Start loops
        this.spawnInterval = setInterval(() => this.spawnZombie(), 2000); // Spawn every 2s
        this.gameLoop();
    },

    stop() {
        this.isActive = false;
        cancelAnimationFrame(this.gameLoopId);
        clearInterval(this.spawnInterval);
        this.zombies.forEach(z => z.element.remove());
        this.zombies = [];
    },

    spawnZombie() {
        if (!this.isActive) return;

        const word = this.wordPool[Math.floor(Math.random() * this.wordPool.length)];
        const x = Math.random() * (this.area.clientWidth - 80) + 40; // Random X padding
        
        const zombieEl = document.createElement('div');
        zombieEl.className = 'zombie-entity';
        // Using a placeholder zombie image (transparent PNG)
        zombieEl.innerHTML = `
            <div class="zombie-word">${word}</div>
            <img class="zombie-img" src="https://cdn-icons-png.flaticon.com/512/3408/3408496.png" alt="zombie">
        `;
        
        this.area.appendChild(zombieEl);

        this.zombies.push({
            id: Math.random().toString(36).substr(2, 9),
            word: word,
            element: zombieEl,
            x: x,
            y: -50, // Start above the screen
            speed: 0.5 + (this.score * 0.05) // Gets faster as score increases!
        });
    },

    gameLoop() {
        if (!this.isActive) return;

        const targetX = this.area.clientWidth / 2;
        const targetY = this.area.clientHeight - 40; // Bottom base

        for (let i = this.zombies.length - 1; i >= 0; i--) {
            let z = this.zombies[i];
            
            // Move towards base
            const dx = targetX - z.x;
            const dy = targetY - z.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                z.x += (dx / distance) * z.speed;
                z.y += (dy / distance) * z.speed;
            }

            // Update DOM
            z.element.style.transform = `translate(${z.x - 30}px, ${z.y}px)`; // -30 to center

            // Check collision with base
            if (z.y >= targetY - 20) {
                this.takeDamage(i);
            }
        }

        // Calculate WPM
        const minutesElapsed = (Date.now() - this.startTime) / 60000;
        if (minutesElapsed > 0) {
            const wpm = Math.round((this.totalCharsTyped / 5) / minutesElapsed);
            document.getElementById('z-wpm').textContent = wpm;
        }

        this.gameLoopId = requestAnimationFrame(() => this.gameLoop());
    },

    handleInput(key) {
        if (key === 'Backspace') {
            this.currentInput = this.currentInput.slice(0, -1);
            app.audio.playClick();
        } else if (key.length === 1 && /[a-zA-Z]/.test(key)) {
            this.currentInput += key.toLowerCase();
            this.totalCharsTyped++;
            app.audio.playClick();
        } else {
            return;
        }

        document.getElementById('z-current-typing').textContent = this.currentInput;
        this.evaluateTyping();
    },

    evaluateTyping() {
        let hasMatch = false;

        this.zombies.forEach((z, index) => {
            const wordEl = z.element.querySelector('.zombie-word');
            
            if (z.word.startsWith(this.currentInput) && this.currentInput.length > 0) {
                hasMatch = true;
                // Highlight typed letters
                const typed = z.word.substring(0, this.currentInput.length);
                const remaining = z.word.substring(this.currentInput.length);
                wordEl.innerHTML = `<span class="z-typed">${typed}</span>${remaining}`;
                
                // If fully typed, kill zombie
                if (this.currentInput === z.word) {
                    this.killZombie(index);
                }
            } else {
                wordEl.innerHTML = z.word; // Reset if mismatch
            }
        });

        // If user typed a wrong letter that matches no starting sequences, flash red and reset
        if (!hasMatch && this.currentInput.length > 0) {
            app.audio.playError();
            document.getElementById('z-current-typing').style.color = 'var(--wrong)';
            setTimeout(() => {
                this.currentInput = "";
                document.getElementById('z-current-typing').textContent = "";
                document.getElementById('z-current-typing').style.color = 'white';
                this.evaluateTyping(); // Re-evaluate to clear highlights
            }, 200);
        }
    },

    killZombie(index) {
        const z = this.zombies[index];
        z.element.classList.add('zombie-death');
        
        // Remove from DOM after animation
        setTimeout(() => z.element.remove(), 300); 
        this.zombies.splice(index, 1);
        
        this.score++;
        this.currentInput = "";
        document.getElementById('z-current-typing').textContent = "";
        this.updateUI();
        
        // Reset all remaining zombie text highlights
        this.zombies.forEach(zomb => {
            zomb.element.querySelector('.zombie-word').innerHTML = zomb.word;
        });
    },

    takeDamage(index) {
        const z = this.zombies[index];
        z.element.remove();
        this.zombies.splice(index, 1);
        
        this.health--;
        this.currentInput = ""; // Reset input so they don't accidentally type the next zombie wrong
        document.getElementById('z-current-typing').textContent = "";
        app.audio.playError();
        
        // Screen shake effect
        this.area.style.transform = "translateX(10px)";
        setTimeout(() => this.area.style.transform = "translateX(-10px)", 50);
        setTimeout(() => this.area.style.transform = "translateX(0)", 100);

        this.updateUI();
        this.evaluateTyping(); // Clear text resets

        if (this.health <= 0) {
            this.gameOver();
        }
    },

    updateUI() {
        document.getElementById('z-health').textContent = this.health;
        document.getElementById('z-score').textContent = this.score;
    },

    gameOver() {
        this.stop();
        alert(`Game Over! 🧟\n\nZombies Defeated: ${this.score}\nWPM: ${document.getElementById('z-wpm').textContent}\n\nGreat effort!`);
        app.showDashboard();
    }
};