let fillInQuestions = []; // 填空題存放
let fillInAnswers = {};   // 填空題答案存放
let shuffled_bool = false;     // 是否洗牌
// DOM 元素參考
const mainPage = document.getElementById("mainPage");
const practicePage = document.getElementById("practicePage");
const questionsDiv = document.getElementById("questions");
const scoreDiv = document.getElementById("score");

// --------------------------
// (1) 載入填空題 JSON 資料
// --------------------------
async function loadFillInQuestions() {
  try {
    const response = await fetch("ENGquestions.json");
    if (!response.ok) {
      throw new Error("無法讀取填空題題庫");
    }
    const data = await response.json();
    fillInQuestions = Array.isArray(data) ? data : Object.values(data); // 確保為陣列
  } catch (error) {
    console.error("讀取填空題題庫失敗：", error);
  }
}

// --------------------------
// (2) 渲染填空題 (合併為單一函式)
// --------------------------
function renderFillInQuestions() {
  questionsDiv.innerHTML = ""; // 清空問題容器

  if (!Array.isArray(fillInQuestions) || fillInQuestions.length === 0) {
    questionsDiv.innerHTML = "<p>無法加載題目，請檢查題庫資料！</p>";
    return;
  }

  fillInQuestions.forEach((q, index) => {
    const questionDiv = document.createElement("div");
    questionDiv.className = "question";
    questionDiv.id = "q" + index;

    questionDiv.innerHTML = `
      <p>${index + 1}. ${q.chinese}</p>
      <p>${q.question}</p>
      <input type="text" id="answer-${index}" class="fill-in-input" placeholder="輸入答案" autocomplete="off">
    `;

    questionsDiv.appendChild(questionDiv);
  });
  if (document.documentElement.classList.contains("dark-mode")) {
    questionsDiv.classList.add("dark-mode");
    document.querySelectorAll(".question").forEach(question => question.classList.add("dark-mode"));
  }
  // 渲染完題目後，監聽輸入框來更新進度
  addInputListeners();
  updateProgress();
}

// --------------------------
// (3) 驗證填空答案
// --------------------------
function validateFillInAnswers() {
  let score = 0;

  fillInQuestions.forEach((q, index) => {
    const userAnswer = document.getElementById(`answer-${index}`).value.trim();
    const correctAnswer = q.ans.trim();
    fillInAnswers[index] = userAnswer; // 儲存用戶答案

    const questionDiv = document.getElementById("q" + index);
    if (userAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
      score++;
      questionDiv.classList.add("correct-answer"); // 答對標示
    } else {
      questionDiv.classList.add("incorrect"); // 答錯標示
      const correctLabel = document.createElement("p");
      correctLabel.className = "correct-answer";
      correctLabel.innerHTML = `正確答案：${correctAnswer}`;
      questionDiv.appendChild(correctLabel);
    }

    // 檢查是否啟用了 dark-mode 並應用樣式
    if (document.documentElement.classList.contains("dark-mode")) {
      // 選取該問題區域內所有標籤並加上 dark-mode 類別
      const labels = questionDiv.querySelectorAll("*");
      labels.forEach(label => label.classList.add("dark-mode"));
    }
  });

  scoreDiv.innerHTML = `你的分數是：${score} / ${fillInQuestions.length}`;
}


// --------------------------
// (4) 繳交填空題答案
// --------------------------
document.getElementById("submitBtn").addEventListener("click", () => {
  validateFillInAnswers();
  document.getElementById("submitBtn").disabled = true; // 繳交後禁用按鈕
  
  document.getElementById("continueBtn").style.display = "inline-block";
});

// --------------------------
// (5) 繼續 (返回主頁)
// --------------------------
document.getElementById("continueBtn").addEventListener("click", () => {
  showPage(mainPage);
  questionsDiv.innerHTML = "";
  scoreDiv.innerHTML = "";
  fillInAnswers = {}; // 清空答案
  document.getElementById("submitBtn").disabled = false;
  
  document.getElementById("continueBtn").style.display = "none";
});

// --------------------------
// (6) 進度條 (更新函式)
// --------------------------
function updateProgress() {
  const progress = document.querySelector(".progress");
  const questions = document.querySelectorAll(".question");

  // 計算已經有填入答案的題目數
  const answeredCount = Array.from(questions).filter(question => {
    const inputs = question.querySelectorAll(".fill-in-input");
    return Array.from(inputs).some(input => input.value.trim() !== "");
  }).length;

  // 題目總數非零才更新
  if (questions.length === 0) {
    progress.style.width = "0%";
    return;
  }

  const percentage = (answeredCount / questions.length) * 100;
  progress.style.width = `${percentage}%`;
}

// 為所有輸入框添加事件監聽器
function addInputListeners() {
  const inputs = document.querySelectorAll(".fill-in-input");
  inputs.forEach(input => {
    input.addEventListener("input", updateProgress);
  });
}

// --------------------------
// (7) 顯示頁面
// --------------------------
function showPage(page) {
  mainPage.style.display = "none";
  practicePage.style.display = "none";
  page.style.display = "block";
  animated_scroll();
}

// --------------------------
// (4) 抽題 (支援是否打亂邏輯)
// --------------------------
function getRandomQuestions(num, shuffle) {
  if (shuffle) {
    // 使用拷貝後的陣列進行打亂，避免修改原陣列
    const shuffled = [...fillInQuestions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, num); // 選取前 num 個
  } else {
    // 按順序選題
    return fillInQuestions.slice(0, num);
  }
}


// --------------------------
// (8) 初始化：選擇題數後，載入、截取題目並渲染
// --------------------------
document.getElementById("startbtn").addEventListener("click", () => {
  const questionCount = parseInt(document.getElementById("questionCount").value, 10);
  if (isNaN(questionCount) || questionCount < 1 || questionCount > fillInQuestions.length) {
    alert(`請輸入有效的題數 (1-${fillInQuestions.length})`);
    return;
  }

  // 判斷 shuffleCheckbox 是否勾選
  const shuffle = document.getElementById("shuffleCheckbox").checked;

  // 根據是否打亂選取題目
  const selectedQuestions = getRandomQuestions(questionCount, shuffle);
  fillInQuestions = selectedQuestions;

  // 渲染題目並切換到練習頁面
  renderFillInQuestions();
  showPage(practicePage);
});


// --------------------------
// (9) 頁面載入完成後執行
// --------------------------
document.addEventListener("DOMContentLoaded", async () => {
  await loadFillInQuestions();
});

// --------------------------
// (10) Dark Mode 切換
// --------------------------
document.getElementById("toggleDarkMode").addEventListener("click", () => {
  const toggleButton = document.getElementById("toggleDarkMode");
  const rect = toggleButton.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const maxRadius = Math.hypot(
    Math.max(centerX, document.documentElement.scrollWidth - centerX),
    Math.max(centerY, document.documentElement.scrollHeight - centerY)
  );

  // 設定 CSS 變數
  document.documentElement.style.setProperty('--x', centerX + 'px');
  document.documentElement.style.setProperty('--y', centerY + 'px');
  document.documentElement.style.setProperty('--r', maxRadius + 'px');

  // 切換 dark-mode 的核心邏輯
  const doToggleDarkMode = () => {
    document.documentElement.classList.toggle('dark-mode');
    document.querySelectorAll(
      ".container, h1, h3, h5, h6, .progress-bar, .question, .button, .score, .history h2, .review-header, .question-block, .ans_color, .correct-answer, .button_qc, .announcement"
    ).forEach((el) => el.classList.toggle("dark-mode"));
    // 切換按鈕文字
    toggleButton.textContent = toggleButton.textContent === "B" ? "W" : "B";
  };

  // 支援 startViewTransition
  if (document.startViewTransition) {
    document.startViewTransition(doToggleDarkMode);
  } else {
    doToggleDarkMode();
  }
});

// 進度條區塊縮放＆位置調整監聽
const stickyElement = document.getElementById('progress-bar');
const toggleDarkMode = document.getElementById("toggleDarkMode");

function animated_scroll(){
  // 只有在練習頁面顯示時才調整
  if (window.getComputedStyle(document.getElementById('practicePage')).display != "none") {
    const stickyRect = stickyElement.getBoundingClientRect();
    const scaleY = stickyRect.top <= 20 ? 0.3 : 1; 
    const scaleX = stickyRect.top <= 20 ? 1.1 : 1; 
    const opacity = stickyRect.top <= 20 ? 0.9 : 1; 
    const td_btn_scale = stickyRect.top <= 20 ? 0.8 : 1; 

    stickyElement.style.transform = `scale(${scaleX}, ${scaleY})`;
    stickyElement.style.opacity = opacity;
    toggleDarkMode.style.transform = `scale(${td_btn_scale})`;
    toggleDarkMode.style.right = stickyRect.top <= 20 ? "0px" : "10px";
    toggleDarkMode.style.bottom = stickyRect.top <= 20 ? "-10px" : "10px";
  } else {
    toggleDarkMode.style.transform = `scale(1)`;
    toggleDarkMode.style.right = "10px";
    toggleDarkMode.style.bottom = "10px";
  }
}
window.addEventListener('scroll', () => {
  animated_scroll()
});
