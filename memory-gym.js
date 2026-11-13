(function () {
  'use strict';

  const KEY = 'independence.memoryGym.history.v1';
  const $ = id => document.getElementById(id);
  const home = $('home'), play = $('play'), history = $('history'), stage = $('stage');
  const colors = ['#4f8cff', '#e5a34b', '#53c99a', '#bd83ee'];
  const symbols = ['🍎', '🚲', '🌙', '🎈', '🐬', '🌻', '📚', '⭐'];
  const stories = [
    {
      text: 'В субботу утром Анна вышла из дома в половине девятого. Сначала она зашла в пекарню за хлебом, затем купила жёлтые тюльпаны для соседки. По дороге домой начался небольшой дождь, и Анна раскрыла красный зонт. Встречу с соседкой она назначила на три часа дня.',
      questions: [
        { q: 'В какой день происходили события?', a: ['В субботу', 'В воскресенье', 'В понедельник'], correct: 0 },
        { q: 'Что Анна купила в пекарне?', a: ['Молоко', 'Хлеб', 'Пирог'], correct: 1 },
        { q: 'Какого цвета был зонт?', a: ['Синий', 'Жёлтый', 'Красный'], correct: 2 },
        { q: 'На какое время назначена встреча?', a: ['На три часа дня', 'На полдень', 'На пять часов'], correct: 0 }
      ]
    },
    {
      text: 'В начале мая Михаил отправился на вокзал на велосипеде. Его поезд отправлялся в 10:20 с третьей платформы. В рюкзаке лежали блокнот, термос с чаем и небольшой фотоаппарат. Перед посадкой Михаил позвонил сестре и сообщил, что вернётся в пятницу.',
      questions: [
        { q: 'В каком месяце происходила поездка?', a: ['В апреле', 'В мае', 'В июне'], correct: 1 },
        { q: 'На чём Михаил добрался до вокзала?', a: ['На автобусе', 'Пешком', 'На велосипеде'], correct: 2 },
        { q: 'С какой платформы отправлялся поезд?', a: ['С третьей', 'Со второй', 'С первой'], correct: 0 },
        { q: 'Что было в рюкзаке?', a: ['Ноутбук и книга', 'Блокнот, термос и фотоаппарат', 'Только одежда'], correct: 1 }
      ]
    }
  ];

  let game = '', sequence = [], step = 0, first = null, matches = 0, turns = 0;
  let words = [], number = '', story = null, storyIndex = 0, storyCorrect = 0;
  let locked = false, timer = null, started = 0;

  function readHistory() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  }
  function saveResult(type, score, detail) {
    const list = readHistory();
    list.unshift({ type, score: String(score), detail: String(detail), date: new Date().toISOString() });
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100))); } catch (_) {
      setFeedback('Не удалось сохранить историю. Возможно, в браузере недостаточно места.', 'bad');
    }
    updateHome();
  }
  function updateHome() {
    const list = readHistory();
    $('sessionCount').textContent = list.length;
    $('progressHint').textContent = list.length
      ? 'Последняя тренировка: ' + new Date(list[0].date).toLocaleString()
      : 'Здесь появится история твоих занятий.';
  }
  function show(which) {
    home.classList.toggle('hidden', which !== 'home');
    play.classList.toggle('hidden', which !== 'play');
    history.classList.toggle('hidden', which !== 'history');
  }
  function setFeedback(message, kind) {
    const el = $('feedback');
    el.textContent = message || '';
    el.className = 'feedback ' + (kind || '');
  }
  function setAction(label, fn) {
    const button = $('mainAction');
    button.disabled = false;
    button.textContent = label;
    button.onclick = fn;
  }
  function shuffle(items) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function start(type) {
    if (timer) clearTimeout(timer);
    timer = null;
    game = type; started = Date.now(); step = 0; turns = 0; matches = 0;
    first = null; locked = false; storyIndex = 0; storyCorrect = 0;
    stage.innerHTML = ''; setFeedback(''); show('play');
    const titles = {
      sequence: 'Запомни последовательность', pairs: 'Найди пары',
      words: 'Слова и ассоциации', numbers: 'Числовая цепочка', story: 'Вспомни историю'
    };
    const instructions = {
      sequence: 'Посмотри на цвета в правильном порядке. Затем повтори последовательность.',
      pairs: 'Открывай карточки по две и находи одинаковые символы.',
      words: 'Запомни слова. Затем введи те, что вспомнишь, без подсказок.',
      numbers: 'Запомни цифры. Когда они исчезнут, введи их в том же порядке.',
      story: 'Прочитай короткий рассказ внимательно. Затем ответь на вопросы по памяти.'
    };
    $('gameTitle').textContent = titles[type];
    $('instruction').textContent = instructions[type];
    $('roundLabel').textContent = '2–5 минут';
    setAction('Начать', begin);
  }
  function begin() {
    if (timer) clearTimeout(timer);
    timer = null; stage.innerHTML = ''; setFeedback('');
    if (game === 'sequence') sequenceGame();
    if (game === 'pairs') pairsGame();
    if (game === 'words') wordsGame();
    if (game === 'numbers') numbersGame();
    if (game === 'story') storyGame();
  }
  function finish(score, detail) {
    if (locked) return;
    locked = true;
    if (timer) clearTimeout(timer);
    timer = null;
    const labels = {
      sequence: 'Последовательность', pairs: 'Найди пары', words: 'Слова',
      numbers: 'Числовая цепочка', story: 'Вспомни историю'
    };
    saveResult(labels[game], score, detail);
    stage.innerHTML = '<div class="result"><h3>Тренировка завершена</h3><p>Результат: <b>' +
      escapeHtml(score) + '</b></p><p>' + escapeHtml(detail) +
      '</p><p class="muted">Это результат одной попытки, а не оценка твоих способностей.</p></div>';
    setFeedback('Хорошая работа! Можно сделать паузу или попробовать ещё раз.', 'good');
    setAction('Повторить', () => start(game));
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function sequenceGame() {
    sequence = Array.from({ length: 5 }, () => Math.floor(Math.random() * 4));
    const box = document.createElement('div');
    box.className = 'word-list'; stage.append(box);
    setAction('Показать цвета', () => {
      $('mainAction').disabled = true;
      let i = 0;
      function flash() {
        if (locked) return;
        if (i >= sequence.length) {
          box.innerHTML = '';
          $('instruction').textContent = 'Теперь нажимай цвета в том же порядке.';
          const choices = document.createElement('div');
          choices.className = 'word-list';
          colors.forEach((color, index) => {
            const button = document.createElement('button');
            button.className = 'tile color'; button.style.background = color;
            button.setAttribute('aria-label', 'Цвет ' + (index + 1));
            button.onclick = () => {
              if (locked) return;
              if (index !== sequence[step]) {
                finish(step + ' из ' + sequence.length, 'Правильно воспроизведено ' + step + ' из ' + sequence.length + ' цветов.');
                return;
              }
              step++;
              if (step === sequence.length) finish(step + ' из ' + sequence.length, 'Вся последовательность воспроизведена верно.');
            };
            choices.append(button);
          });
          stage.append(choices);
          $('mainAction').disabled = false;
          setAction('Завершить позже', () => finish(step + ' из ' + sequence.length, 'Тренировка завершена по твоему желанию.'));
          return;
        }
        const tile = document.createElement('span');
        tile.className = 'tile color'; tile.style.background = colors[sequence[i]];
        box.innerHTML = ''; box.append(tile); i++;
        timer = setTimeout(() => { box.innerHTML = ''; timer = setTimeout(flash, 260); }, 620);
      }
      flash();
    });
  }

  function pairsGame() {
    const deck = shuffle([...symbols.slice(0, 6), ...symbols.slice(0, 6)]);
    stage.innerHTML = '<div class="answer-grid"></div>';
    const grid = stage.firstChild;
    deck.forEach((symbol, index) => {
      const button = document.createElement('button');
      button.className = 'card-tile'; button.textContent = '?';
      button.setAttribute('aria-label', 'Карточка ' + (index + 1));
      button.onclick = () => {
        if (locked || button.classList.contains('matched') || button.classList.contains('open')) return;
        button.textContent = symbol; button.classList.add('open'); turns++;
        if (!first) { first = button; return; }
        locked = true;
        const previous = first; first = null;
        if (previous.textContent === button.textContent) {
          previous.classList.add('matched'); button.classList.add('matched');
          matches++; locked = false;
          if (matches === 6) finish(matches + ' из 6 пар', 'Найдены все пары за ' + turns + ' открытий карточек.');
        } else {
          timer = setTimeout(() => {
            previous.textContent = '?'; button.textContent = '?';
            previous.classList.remove('open'); button.classList.remove('open');
            locked = false; timer = null;
          }, 750);
        }
      };
      grid.append(button);
    });
    setAction('Закончить тренировку', () => finish(matches + ' из 6 пар', 'Найдено ' + matches + ' пар; открыто ' + turns + ' карточек.'));
  }

  function wordsGame() {
    const bank = ['облако', 'река', 'ключ', 'лампа', 'яблоко', 'поезд', 'книга', 'сосна', 'море', 'часы'];
    words = shuffle(bank).slice(0, 6);
    const list = document.createElement('div'); list.className = 'word-list';
    words.forEach(word => { const item = document.createElement('span'); item.className = 'word'; item.textContent = word; list.append(item); });
    stage.append(list);
    let seconds = 10;
    const counter = document.createElement('p'); counter.className = 'muted'; counter.textContent = 'Время на запоминание: ' + seconds + ' сек.';
    stage.append(counter);
    setAction('Я запомнил', recall);
    function tick() {
      if (locked) return;
      seconds--; counter.textContent = 'Время на запоминание: ' + seconds + ' сек.';
      if (seconds <= 0) recall(); else timer = setTimeout(tick, 1000);
    }
    timer = setTimeout(tick, 1000);
    function recall() {
      if (timer) clearTimeout(timer); timer = null;
      stage.innerHTML = '';
      $('instruction').textContent = 'Введи слова, которые запомнил. Разделяй их пробелами или запятыми.';
      const input = document.createElement('textarea');
      input.className = 'recall-input'; input.rows = 4;
      input.placeholder = 'Введи слова по памяти'; input.id = 'wordRecall';
      stage.append(input);
      setAction('Проверить', () => {
        const answer = new Set(input.value.toLocaleLowerCase('ru').split(/[\s,;.!?]+/).filter(Boolean));
        const count = words.filter(word => answer.has(word)).length;
        finish(count + ' из ' + words.length, 'Вспомнил ' + count + ' из ' + words.length + ' слов.');
      });
    }
  }

  function numbersGame() {
    const length = 5 + Math.min(3, Math.floor(readHistory().length / 5));
    number = Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
    const display = document.createElement('div'); display.className = 'number-display';
    display.textContent = number; stage.append(display);
    let seconds = 5 + Math.floor(length / 2);
    const counter = document.createElement('p'); counter.className = 'muted';
    counter.textContent = 'Запомни число. Оно исчезнет через ' + seconds + ' сек.';
    stage.append(counter);
    setAction('Я запомнил', enterAnswer);
    function tick() {
      if (locked) return;
      seconds--; counter.textContent = 'Запомни число. Оно исчезнет через ' + seconds + ' сек.';
      if (seconds <= 0) enterAnswer(); else timer = setTimeout(tick, 1000);
    }
    timer = setTimeout(tick, 1000);
    function enterAnswer() {
      if (timer) clearTimeout(timer); timer = null;
      stage.innerHTML = '';
      $('instruction').textContent = 'Введи цифры в том же порядке.';
      const input = document.createElement('input');
      input.className = 'recall-input'; input.inputMode = 'numeric';
      input.autocomplete = 'off'; input.maxLength = 12; input.placeholder = 'Твоя последовательность';
      stage.append(input);
      setAction('Проверить', () => {
        const answer = input.value.replace(/\D/g, '');
        let correct = 0;
        for (let i = 0; i < Math.min(answer.length, number.length); i++) {
          if (answer[i] === number[i]) correct++; else break;
        }
        finish(correct + ' из ' + number.length, answer === number
          ? 'Числовая последовательность воспроизведена полностью.'
          : 'Совпало подряд с начала: ' + correct + ' цифр из ' + number.length + '.');
      });
    }
  }

  function storyGame() {
    story = stories[Math.floor(Math.random() * stories.length)];
    const passage = document.createElement('p'); passage.className = 'story-text'; passage.textContent = story.text;
    stage.append(passage);
    let seconds = 20;
    const counter = document.createElement('p'); counter.className = 'muted';
    counter.textContent = 'Время на чтение: ' + seconds + ' сек.';
    stage.append(counter);
    setAction('Я прочитал', startQuestions);
    function tick() {
      if (locked) return;
      seconds--; counter.textContent = 'Время на чтение: ' + seconds + ' сек.';
      if (seconds <= 0) startQuestions(); else timer = setTimeout(tick, 1000);
    }
    timer = setTimeout(tick, 1000);
    function startQuestions() {
      if (timer) clearTimeout(timer); timer = null;
      stage.innerHTML = ''; storyIndex = 0; storyCorrect = 0;
      showStoryQuestion();
    }
  }
  function showStoryQuestion() {
    const item = story.questions[storyIndex];
    $('instruction').textContent = 'Вопрос ' + (storyIndex + 1) + ' из ' + story.questions.length;
    const question = document.createElement('h3'); question.className = 'question'; question.textContent = item.q;
    const options = document.createElement('div'); options.className = 'story-options';
    item.a.forEach((answer, index) => {
      const button = document.createElement('button'); button.className = 'option'; button.textContent = answer;
      button.onclick = () => {
        if (locked) return;
        locked = true;
        if (index === item.correct) storyCorrect++;
        storyIndex++;
        timer = setTimeout(() => {
          timer = null; locked = false; stage.innerHTML = '';
          if (storyIndex >= story.questions.length) {
            finish(storyCorrect + ' из ' + story.questions.length, 'Правильных ответов: ' + storyCorrect + ' из ' + story.questions.length + '.');
          } else showStoryQuestion();
        }, 250);
      };
      options.append(button);
    });
    stage.append(question, options);
  }

  function renderHistory() {
    const list = readHistory();
    $('historyList').innerHTML = list.length ? list.map(item =>
      '<div class="history-item"><b>' + escapeHtml(item.type) + '</b> — ' + escapeHtml(item.score) +
      '<div class="muted">' + new Date(item.date).toLocaleString() + ' · ' + escapeHtml(item.detail) +
      '</div></div>').join('') : '<p class="muted">Пока нет сохранённых тренировок.</p>';
  }

  document.querySelectorAll('[data-game]').forEach(button =>
    button.addEventListener('click', () => start(button.dataset.game)));
  $('homeBtn').onclick = () => { if (timer) clearTimeout(timer); timer = null; locked = true; show('home'); updateHome(); };
  $('historyBtn').onclick = () => { renderHistory(); show('history'); };
  $('historyBack').onclick = () => { show('home'); updateHome(); };
  $('clearHistory').onclick = () => {
    if (confirm('Удалить всю историю тренировок на этом устройстве?')) {
      localStorage.removeItem(KEY); renderHistory(); updateHome();
    }
  };
  updateHome();
})();
