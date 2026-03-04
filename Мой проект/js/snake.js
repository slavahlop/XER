// ===============================================
// МУЛЬТИПЛЕЕРНАЯ ЗМЕЙКА НА FIRESTORE (Арена)
// ===============================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('currentScore');
const gameOverEl = document.getElementById('gameOver');
const finalScoreEl = document.getElementById('finalScore');
const lbContent = document.getElementById('lb-content');

// Константы арены
const ARENA_WIDTH = 2500;
const ARENA_HEIGHT = 2500;
const TILE_SIZE = 20;

let gameRunning = false;
let myId = null;
let nickname = "Гость";
let score = 0;

// Состояние игры
let players = {};
let foods = {};
let mySnake = {
    x: Math.random() * (ARENA_WIDTH - 200) + 100,
    y: Math.random() * (ARENA_HEIGHT - 200) + 100,
    tail: [], // [{x, y}]
    length: 5,
    color: getRandomColor(),
    angle: 0,
    speed: 4,
    dead: false
};

// Ввод мыши
let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;
const camera = { x: 0, y: 0 };

canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

// Кнопки интерфейса
document.getElementById('restartBtn').addEventListener('click', restartGame);
document.getElementById('menuBtn').addEventListener('click', () => {
    window.location.href = 'index.html?fromGame=true';
});
document.addEventListener('keydown', e => {
    if (e.code === 'Escape') {
        window.location.href = 'index.html?fromGame=true';
    }
});

// ГЕНЕРАЦИЯ ЦВЕТА
function getRandomColor() {
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899'];
    return colors[Math.floor(Math.random() * colors.length)];
}

// === FIREBASE ИНИЦИАЛИЗАЦИЯ И СИНХРОНИЗАЦИЯ ===
let db = null;
let unsubscribePlayers = null;
let unsubscribeFoods = null;
let syncInterval = null;

function initNetwork() {
    if (typeof firebase === 'undefined') return;

    db = firebase.firestore();

    const user = firebase.auth().currentUser;
    myId = user ? user.uid : 'guest_' + Math.random().toString(36).substr(2, 9);

    if (user) {
        db.collection('users').doc(user.uid).get().then(doc => {
            if (doc.exists && doc.data().nickname) nickname = doc.data().nickname;
            startGame();
        });
    } else {
        startGame();
    }
}

firebase.auth().onAuthStateChanged(user => {
    initNetwork();
});

// Запуск при отсутствии инициализации через 2 сек (если гость сразу)
setTimeout(() => { if (!gameRunning && !myId) initNetwork(); }, 2000);

function startGame() {
    if (gameRunning) return;
    gameRunning = true;
    gameOverEl.style.display = 'none';

    // Инициализация базы данных
    const playersRef = db.collection('snake_players');
    const foodRef = db.collection('snake_foods');

    mySnake = {
        x: Math.random() * (ARENA_WIDTH - 200) + 100,
        y: Math.random() * (ARENA_HEIGHT - 200) + 100,
        tail: [],
        length: 5,
        color: getRandomColor(),
        angle: 0,
        speed: 4,
        dead: false,
        score: 0,
        nickname: nickname
    };
    score = 0;
    scoreEl.textContent = score;

    // Очистка при закрытии
    window.addEventListener('beforeunload', () => {
        if (myId && !myId.startsWith('guest')) {
            playersRef.doc(myId).delete();
        }
    });

    // Слушаем других игроков
    unsubscribePlayers = playersRef.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === "removed") {
                delete players[change.doc.id];
            } else {
                const data = change.doc.data();
                if (change.doc.id !== myId && !data.dead) {
                    players[change.doc.id] = data;
                }
            }
        });
        updateLeaderboard();
    });

    // Слушаем еду
    unsubscribeFoods = foodRef.limit(20).onSnapshot(snapshot => {
        let currentFoods = {};
        snapshot.forEach(doc => {
            currentFoods[doc.id] = doc.data();
        });
        foods = currentFoods;

        // Если еды мало, генерируем (простой механизм без транзакций)
        if (Object.keys(foods).length < 20) {
            spawnFoodLocally();
        }
    });

    // Синхронизируем СЕБЯ каждые 100мс
    syncInterval = setInterval(() => {
        if (!mySnake.dead) {
            playersRef.doc(myId).set({
                x: Math.round(mySnake.x),
                y: Math.round(mySnake.y),
                tail: mySnake.tail, // отправляем только координаты хвоста
                color: mySnake.color,
                score: score,
                nickname: nickname,
                dead: mySnake.dead,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    }, 100);

    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function spawnFoodLocally() {
    const newFoodId = 'food_' + Math.random().toString(36).substr(2, 9);
    db.collection('snake_foods').doc(newFoodId).set({
        x: Math.random() * (ARENA_WIDTH - 50) + 25,
        y: Math.random() * (ARENA_HEIGHT - 50) + 25,
        color: getRandomColor()
    });
}

function gameOver() {
    gameRunning = false;
    mySnake.dead = true;
    gameOverEl.style.display = 'block';
    finalScoreEl.textContent = score;

    clearInterval(syncInterval);
    db.collection('snake_players').doc(myId).delete();

    // Сохранить рекорд
    const user = firebase.auth().currentUser;
    if (user) {
        db.collection('users').doc(user.uid).get().then(doc => {
            const best = doc.data()?.records?.snakeBest || 0;
            if (score > best) {
                db.collection('users').doc(user.uid).set({ records: { snakeBest: score } }, { merge: true });
            }
        });
    }
}

function restartGame() {
    gameOverEl.style.display = 'none';
    startGame();
}

function updateLeaderboard() {
    let allPlayers = Object.values(players);
    allPlayers.push({ nickname: nickname, score: score, isMe: true });
    allPlayers.sort((a, b) => b.score - a.score);

    let html = '';
    for (let i = 0; i < Math.min(5, allPlayers.length); i++) {
        const p = allPlayers[i];
        html += `<div class="lb-row" style="color:${p.isMe ? '#fbbf24' : '#fff'}">
               <span>${i + 1}. ${p.nickname}</span>
               <span>${p.score}</span>
             </div>`;
    }
    lbContent.innerHTML = html;
}

// === ЛОГИКА ДВИЖЕНИЯ ===
let lastTime = 0;
function gameLoop(time) {
    if (!gameRunning) return;

    const deltaTime = time - lastTime;
    lastTime = time;

    // Рассчитываем угол к мыши относительно центра экрана (где игрок)
    const targetAngle = Math.atan2(mouseY - canvas.height / 2, mouseX - canvas.width / 2);

    // Простое сглаживание поворота
    const diff = targetAngle - mySnake.angle;
    mySnake.angle += Math.atan2(Math.sin(diff), Math.cos(diff)) * 0.1;

    // Движение вперед (нормализованно по времени)
    const dtFixed = Math.min(deltaTime, 30) / 16.6;
    mySnake.x += Math.cos(mySnake.angle) * mySnake.speed * dtFixed;
    mySnake.y += Math.sin(mySnake.angle) * mySnake.speed * dtFixed;

    // Границы арены
    if (mySnake.x < 0) mySnake.x = 0;
    if (mySnake.x > ARENA_WIDTH) mySnake.x = ARENA_WIDTH;
    if (mySnake.y < 0) mySnake.y = 0;
    if (mySnake.y > ARENA_HEIGHT) mySnake.y = ARENA_HEIGHT;

    // Обновление хвоста (сохраняем историю позиций)
    mySnake.tail.unshift({ x: Math.round(mySnake.x), y: Math.round(mySnake.y) });
    // Расстояние между сегментами хвоста - берем каждую N-ю точку
    const historyNeeded = mySnake.length * 4;
    if (mySnake.tail.length > historyNeeded) {
        mySnake.tail.pop();
    }

    // === СТОЛКНОВЕНИЯ С ЕДОЙ ===
    for (let id in foods) {
        let f = foods[id];
        let dx = mySnake.x - f.x;
        let dy = mySnake.y - f.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        // Съели
        if (dist < TILE_SIZE + 10) {
            delete foods[id];
            db.collection('snake_foods').doc(id).delete();
            score += 10;
            mySnake.length += 2;
            scoreEl.textContent = score;
        }
    }

    // === ПРОВЕРКА СМЕРТИ (Врезались в других) ===
    for (let id in players) {
        let p = players[id];
        if (p.dead || !p.tail) continue;
        // Пробегаем по хвосту противника
        for (let i = 0; i < p.tail.length; i += 4) {
            if (!p.tail[i]) continue;
            let dx = mySnake.x - p.tail[i].x;
            let dy = mySnake.y - p.tail[i].y;
            if (Math.sqrt(dx * dx + dy * dy) < TILE_SIZE) { // врезались!
                gameOver();
                return; // выход из функции чтобы не рисовать дохлую
            }
        }
    }

    draw();
    requestAnimationFrame(gameLoop);
}

// === ОТРИСОВКА ===
function draw() {
    // Камера следит за игроком, но не выходит за пределы арены + отступы
    camera.x = mySnake.x - canvas.width / 2;
    camera.y = mySnake.y - canvas.height / 2;

    // Фон
    ctx.fillStyle = '#000011';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Сетка арены для ощущения пространства
    ctx.strokeStyle = '#0f2027';
    ctx.lineWidth = 1;
    const startX = Math.floor(camera.x / 100) * 100;
    const startY = Math.floor(camera.y / 100) * 100;
    for (let x = startX; x < camera.x + canvas.width; x += 100) {
        ctx.beginPath(); ctx.moveTo(x, camera.y); ctx.lineTo(x, camera.y + canvas.height); ctx.stroke();
    }
    for (let y = startY; y < camera.y + canvas.height; y += 100) {
        ctx.beginPath(); ctx.moveTo(camera.x, y); ctx.lineTo(camera.x + canvas.width, y); ctx.stroke();
    }

    // Границы арены (Красная линия)
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Рисуем еду
    ctx.shadowBlur = 10;
    for (let id in foods) {
        let f = foods[id];
        ctx.fillStyle = f.color;
        ctx.shadowColor = f.color;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 8, 0, Math.PI * 2);
        ctx.fill();

        // Эффект пульсации
        ctx.strokeStyle = `rgba(255,255,255,0.5)`;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Рисуем других игроков
    for (let id in players) {
        drawSnake(players[id]);
    }

    // Рисуем себя
    drawSnake(mySnake, true);

    ctx.restore();
}

function drawSnake(s, isMe = false) {
    if (!s || !s.tail || s.tail.length === 0) return;

    // Особенности: рисуем с конца чтобы голова была сверху
    ctx.fillStyle = s.color;
    ctx.shadowBlur = isMe ? 15 : 5;
    ctx.shadowColor = s.color;

    // Хвост
    for (let i = s.tail.length - 1; i >= 0; i -= 4) {
        if (!s.tail[i]) continue;
        let r = Math.max(5, TILE_SIZE / 2 - (i / s.tail.length) * 4); // хвост сужается
        ctx.beginPath();
        ctx.arc(s.tail[i].x, s.tail[i].y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // Голова
    ctx.beginPath();
    let headX = isMe ? s.x : s.tail[0].x;
    let headY = isMe ? s.y : s.tail[0].y;

    ctx.arc(headX, headY, TILE_SIZE / 2 + 2, 0, Math.PI * 2);
    ctx.fill();

    // Имя над головой
    ctx.shadowBlur = 0;
    ctx.fillStyle = isMe ? '#fbbf24' : '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.nickname || 'Unknown', headX, headY - 15);
}
