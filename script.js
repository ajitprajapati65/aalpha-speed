// --- 1. DYNAMIC TEXT POOLS (ENGLISH & HINDI) ---
const textPools = {
    en: {
        confidence: ["ask", "dad", "fall", "glad", "flash", "glass", "half", "sad", "all", "falls", "dash", "lass", "flag", "had", "hall", "salad"],
        easy: ["The cat sat on the mat.", "A quick brown fox jumps.", "She likes to read books.", "Water is good for health.", "Look at the blue sky.", "He ran fast to win."],
        medium1: ["In 2026, technology is everywhere.", "Can you type at 60 WPM?", "Practice makes a man perfect.", "Always keep your eyes on the screen."],
        medium2: ["Focus on accuracy before speed.", "Numbers like 100 or 500 are easy.", "Don't look at your keyboard.", "Typing is a great skill to learn in 2026."],
        hard: ["The Industrial Revolution (1760-1840) changed everything!", "Email me at user_name@domain.com.", "He said, \"What a beautiful day!\"", "Item #45 costs $99.99."],
        extreme: ["The appLi company definately wants you to beleive.", "Is this technollogy succesfull?", "You must definately beleive in appLi."]
    },
    hi: {
        // Kruti Dev encoded strings - User types English letters, CSS renders Hindi
        confidence: ["dks", "vkbZ", "esjs", "vki", "ge", "rks", "gS", "Hkk", "fld", "jgs"],
        easy: ["esjk uke D;k gS", "vki dSls gS", "Hkkjr esjk ns'k gS", "ge lc ,d gS", "dke djks", "le; eY;oku gS"],
        medium1: ["vkt dk fnu cgqr vPNk gSA", "dEI;wVj lhiuk vklku gSA", "D;k vki esjh enn djsaxs"],
        medium2: ["bZekuZnkjh lcls vPNh uhfr gS", "ifjJae gh lQyrk dh dqat gS", "ges'kk lR; cksyks"],
        hard: ["fo|kFkhZ thou dM+h esgur dh ekax djrk gSA", "lajpukRed iz.kkyh esjh ds fy, Qk;nsean gSA"],
        extreme: ["vR;f/kd vk'kkoq.kZ fopkj/kkjk ykHk gksrk gSA", "Hkfo\"; ds fy, rduhd dk fodkl vfuok;Z gSA"]
    }
};

function generateWords(pool, targetWordCount) {
    let words = [];
    while (words.length < targetWordCount) {
        let sentence = pool[Math.floor(Math.random() * pool.length)];
        words.push(...sentence.split(' '));
    }
    return words.slice(0, targetWordCount).join(' ');
}

// Generate Lessons Array Dynamically
function getLessons(lang) {
    const pools = textPools[lang];
    const lessons = [];
    for (let i = 1; i <= 30; i++) {
        let tier, tierClass, targetWords, pool, isInfinite = false, desc;
        if (i <= 5) { tier = "Keyboard Confidence"; tierClass = "tier-confidence"; targetWords = 80; pool = pools.confidence; desc = lang === 'hi' ? "Kruti Dev basic patterns." : "Home row realistic words."; }
        else if (i <= 10) { tier = "Easy Paragraph"; tierClass = "tier-easy"; targetWords = 150; pool = pools.easy; isInfinite = true; desc = "Infinite typing mode!"; }
        else if (i <= 15) { tier = "Medium Level 1"; tierClass = "tier-medium"; targetWords = 220; pool = pools.medium1; desc = "Longer sentences."; }
        else if (i <= 20) { tier = "Medium Level 2"; tierClass = "tier-medium"; targetWords = 300; pool = pools.medium2; desc = "Advanced punctuation."; }
        else if (i <= 25) { tier = "Hard Level"; tierClass = "tier-hard"; targetWords = 400; pool = pools.hard; desc = "Complex formatting."; }
        else { tier = "Extreme Level"; tierClass = "tier-extreme"; targetWords = 500; pool = pools.extreme; desc = "Tricky keystrokes."; }
        lessons.push({ id: i, tier, tierClass, targetWords, pool, isInfinite, desc });
    }
    return lessons;
}

// --- 2. APP OBJECT ---
const app = {
    formatTime(timeInSeconds) {
        if (this.maxTime === 0) return '∞'; // Agar no timer hai toh infinity dikhaye
        const m = Math.floor(timeInSeconds / 60);
        const s = timeInSeconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`; // Agar second 10 se kam hai toh aage '0' lagaye (e.g. 2:05)
    },
    user: null,
    currentLang: 'en', // 'en' or 'hi'
    progress: {
        en: { bestWPM: 0, bestAcc: 0, completed: 0 },
        hi: { bestWPM: 0, bestAcc: 0, completed: 0 }
    },
    currentLessonId: null,
    textArray: [],
    charIndex: 0,
    timer: null,
    maxTime: 60,
    timeLeft: 60,
    timeElapsed: 0,
    isTyping: false,
    stats: { totalTyped: 0, correctChars: 0, mistakes: 0 },

    init() {
        // Load combined progress data safely
        const storedProg = localStorage.getItem('aalpha_progress_v2');
        if (storedProg) {
            this.progress = JSON.parse(storedProg);
        } else {
            // Migrate old progress if it exists
            const oldProg = localStorage.getItem('aalpha_progress');
            if(oldProg) this.progress.en = JSON.parse(oldProg);
        }

        const storedLang = localStorage.getItem('aalpha_lang');
        if (storedLang) this.currentLang = storedLang;
        
        if(localStorage.getItem('aalpha_theme') === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }

        this.updateLangUI();
        this.setupEventListeners();
        this.switchView('login-view');
    },

    saveData() {
        localStorage.setItem('aalpha_progress_v2', JSON.stringify(this.progress));
        localStorage.setItem('aalpha_lang', this.currentLang);
    },

    setLanguage(lang) {
        if(this.currentLang === lang) return;
        this.currentLang = lang;
        this.updateLangUI();
        this.saveData();
        
        // If they are on the dashboard, refresh it. If typing, kick them back to dash.
        if (document.getElementById('typing-view').classList.contains('active') || 
            document.getElementById('result-view').classList.contains('active')) {
            this.showDashboard();
        } else if (document.getElementById('dashboard-view').classList.contains('active')) {
            this.showDashboard();
        }
    },

    updateLangUI() {
        document.getElementById('lang-en').classList.remove('active');
        document.getElementById('lang-hi').classList.remove('active');
        document.getElementById(`lang-${this.currentLang}`).classList.add('active');
    },

    setupEventListeners() {
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const fname = document.getElementById('fname').value.trim();
            const lname = document.getElementById('lname').value.trim();
            if (fname && lname) {
                this.user = { fname, lname, fullName: `${fname} ${lname}` };
                this.showDashboard();
            }
        });

        const inputEl = document.getElementById('hidden-input');
        inputEl.addEventListener('keydown', (e) => {
            if (!this.isTyping && this.charIndex === 0 && e.key !== 'Tab') this.startTimer();
            this.handleKeystroke(e);
        });
        // Custom timer input logic (Minutes to Seconds)
        document.getElementById('custom-timer').addEventListener('input', (e) => {
            const valInMins = parseFloat(e.target.value);
            if(valInMins > 0) {
                const valInSecs = Math.floor(valInMins * 60); // Convert to seconds
                this.maxTime = valInSecs;
                this.timeLeft = valInSecs;
                // Display par seconds hi dikhayega (e.g. 1 minute = 60s)
                document.getElementById('live-time').textContent = valInSecs; 
            }
        });
    },

    switchView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        
        if(this.user) {
            document.getElementById('nav-user-name').textContent = this.user.fullName;
            document.getElementById('nav-user-name').style.display = 'block';
            document.getElementById('lang-switch-container').style.display = 'flex';
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
        
        // Update Dashboard Stats
        document.getElementById('dash-en-wpm').textContent = this.progress.en.bestWPM;
        document.getElementById('dash-hi-wpm').textContent = this.progress.hi.bestWPM;

        const grid = document.getElementById('lessons-grid');
        grid.innerHTML = '';
        
        const currentLessons = getLessons(this.currentLang);
        
        currentLessons.forEach(lesson => {
            const div = document.createElement('div');
            div.className = `lesson-card glass`;
            div.innerHTML = `<div class="tier ${lesson.tierClass}">${lesson.tier}</div><h3>Lesson ${lesson.id}</h3><div style="font-size:0.8rem;color:var(--text-muted)">${lesson.targetWords} Words</div>`;
            div.onclick = () => this.loadLesson(lesson.id, currentLessons);
            grid.appendChild(div);
        });
    },

    loadLesson(id, currentLessons) {
        if(!currentLessons) currentLessons = getLessons(this.currentLang);
        this.currentLessonId = id;
        const lesson = currentLessons[id - 1];
        
        this.switchView('typing-view');
        
        document.getElementById('current-lesson-title').textContent = `Lesson ${lesson.id}: ${lesson.tier}`;
        document.getElementById('current-lesson-desc').textContent = lesson.desc;
        
        // Handle Kruti Dev Font Toggle
        const typingArea = document.getElementById('typing-text');
        if (this.currentLang === 'hi') {
            typingArea.classList.add('kruti-font');
        } else {
            typingArea.classList.remove('kruti-font');
        }

        this.resetStats();
        this.textArray = generateWords(lesson.pool, lesson.targetWords).split('');
        this.handleTimerSelection();
        this.renderInitialText();
        setTimeout(() => document.getElementById('hidden-input').focus(), 100);
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

    handleTimerSelection() {
        const select = document.getElementById('timer-select');
        const customInput = document.getElementById('custom-timer');
        
        if (select.value === 'custom') {
            customInput.style.display = 'inline-block';
            // User ne minutes dale, humne 60 se multiply karke seconds bana diya
            const mins = parseFloat(customInput.value) || 1; // Default 1 minute
            this.maxTime = Math.floor(mins * 60);
        } else {
            customInput.style.display = 'none';
            this.maxTime = parseInt(select.value);
        }
        
        this.timeLeft = this.maxTime;
        document.getElementById('live-time').textContent = this.maxTime === 0 ? '∞' : this.timeLeft;
        this.resetStats();
    },

    startTimer() {
        this.isTyping = true;
        this.timer = setInterval(() => {
            this.timeElapsed++;
            if (this.maxTime > 0) {
                this.timeLeft--;
                document.getElementById('live-time').textContent = this.formatTime(this.timeLeft);
                if (this.timeLeft <= 0) this.endLesson();
            } else {
                document.getElementById('live-time').textContent = this.formatTime(this.timeElapsed);
            }
            const mins = this.timeElapsed / 60;
            document.getElementById('live-wpm').textContent = Math.round((this.stats.totalTyped / 5) / mins) || 0;
        }, 1000);
    },

    handleKeystroke(e) {
        const ignored = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Enter', 'Escape'];
        if (ignored.includes(e.key)) return;
        const spans = document.getElementById('typing-text').childNodes;
        
        if (e.key === 'Backspace') {
            if (this.charIndex > 0) {
                spans[this.charIndex].classList.remove('active');
                this.charIndex--;
                spans[this.charIndex].className = 'char active';
                this.scrollToActive();
            }
            return;
        }

        e.preventDefault();
        const typed = e.key;
        // Simple raw string comparison - Works natively for Kruti Dev layout!
        const expected = this.textArray[this.charIndex];
        this.stats.totalTyped++;

        if (typed === expected) {
            spans[this.charIndex].classList.add('correct');
            this.stats.correctChars++;
        } else {
            spans[this.charIndex].classList.add('wrong');
            this.stats.mistakes++;
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
        if (active.offsetTop - container.scrollTop > 120) container.scrollTop = active.offsetTop - 120;
        else if (active.offsetTop - container.scrollTop < 20) container.scrollTop = active.offsetTop - 20;
    },

    resetStats() {
        clearInterval(this.timer);
        this.isTyping = false;
        this.charIndex = 0;
        this.timeElapsed = 0;
        this.stats = { totalTyped: 0, correctChars: 0, mistakes: 0 };
        document.getElementById('live-wpm').textContent = '0';
        document.getElementById('hidden-input').value = '';
        document.getElementById('scroll-container').scrollTop = 0;
    },

    resetLesson() { this.loadLesson(this.currentLessonId); },

    endLesson() {
        clearInterval(this.timer);
        const mins = this.timeElapsed / 60;
        const gross = Math.round((this.stats.totalTyped / 5) / mins) || 0;
        const net = Math.max(0, Math.round(gross - (this.stats.mistakes / mins)));
        const acc = this.stats.totalTyped > 0 ? Math.round((this.stats.correctChars / this.stats.totalTyped) * 100) : 0;
        this.showResults(net, gross, acc);
    },

    showResults(net, gross, acc) {
        this.switchView('result-view');
        
        // Greeting Update
        document.getElementById('result-greeting').textContent = `Great Job, ${this.user.fname}!`;
        
        // Basic Stats Update
        document.getElementById('res-net-wpm').textContent = net;
        document.getElementById('res-gross-wpm').textContent = gross + " WPM";
        document.getElementById('res-acc').textContent = acc + '%';
        
        // YAHAN SE 'res-total-chars' WALI LINE HATA DI GAYI HAI 🚀
        document.getElementById('res-correct-chars').textContent = this.stats.correctChars;
        document.getElementById('res-mistakes').textContent = this.stats.mistakes;
        document.getElementById('res-time').textContent = this.formatTime(this.timeElapsed);
        
        // Badge Logic (Colors based on accuracy)
        const badge = document.getElementById('rating-badge');
        if (acc >= 90) {
            badge.textContent = "Excellent 🔥";
            badge.style.background = "var(--correct)";
            badge.style.boxShadow = "0 0 15px var(--correct)";
        } else if (acc >= 75) {
            badge.textContent = "Good 🟢";
            badge.style.background = "var(--primary)";
            badge.style.boxShadow = "0 0 15px var(--primary)";
        } else {
            badge.textContent = "Practice Needed 🔴";
            badge.style.background = "var(--wrong)";
            badge.style.boxShadow = "0 0 15px var(--wrong)";
        }

        // New Feature: Dynamic Rank Logic (Based on Net WPM)
        let rank = "Beginner 🐢";
        if (net >= 80) rank = "Typing God ⚡";
        else if (net >= 60) rank = "Ninja Hacker 🥷";
        else if (net >= 40) rank = "Pro Typist 🚀";
        else if (net >= 20) rank = "Steady Learner 🚶";
        
        document.getElementById('performance-title').textContent = `Rank: ${rank}`;

        // Save progress explicitly to the current language pool
        const langData = this.progress[this.currentLang];
        if (net > langData.bestWPM) langData.bestWPM = net;
        if (acc > langData.bestAcc) langData.bestAcc = acc;
        langData.completed++;
        this.saveData();
    },

    nextLesson() { if (this.currentLessonId < 30) this.loadLesson(this.currentLessonId + 1); }
};

window.onload = () => app.init();