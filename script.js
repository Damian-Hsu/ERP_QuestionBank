let chapters = [];               // 從 chapters_config.json 載入
let questionBank = {}; 
let selectedQuestions = [];     // 存放最終選擇出的題目ID
let answers = {};               // 紀錄使用者作答(key=題目index, val=選項)
let correctAnswers = {};        // 紀錄正確答案(key=題目index, val=正解)
let answeredCount = 0;          // 已回答題數
let startTime, endTime;         // 計時
let usedQuestions = [];         // 已使用過的題目（跨次測驗）保留功能，懶得用
let availableQuestionIDs = [];  // 根據所選章節，動態生成可抽取的題目清單
let now_history_object = {};    // 紀錄目前瀏覽的歷史紀錄
// 進入回顧頁時紀錄是否來自「錯題回顧」
let reviewFromAllWrong = false; 

// DOM 參考
const mainPage            = document.getElementById("mainPage");
const quizPage            = document.getElementById("quizPage");
const reviewPage          = document.getElementById("reviewPage");
const allWrongPage        = document.getElementById("allWrongPage");

const chapterSelectDiv    = document.getElementById("chapterSelect");
const questionCountInput  = document.getElementById("questionCount");
const questionCountLabel  = document.getElementById("questionCountLabel");

const questionsDiv        = document.getElementById("questions");
const scoreDiv            = document.getElementById("score");
const historyList         = document.getElementById("historyList");
const allWrongListDiv     = document.getElementById("allWrongList");

const reviewHeader        = document.getElementById("reviewHeader");
const reviewQuestionsDiv  = document.getElementById("reviewQuestions");
const toggleWrongBtn      = document.getElementById("toggleWrongBtn");
const selectAllCheckbox   = document.getElementById("selectAll");

// --------------------------
// (1) 載入章節設定 + 動態建立UI
// --------------------------
async function loadChapters() {
  try {
    const resp = await fetch("chapters_config.json");
    if (!resp.ok) throw new Error("無法讀取 chapters_config.json");
    chapters = await resp.json();

    // 成功讀取後，建立 UI
    createChapterSelection();
    updateAvailableQuestionIDs();
  } catch (error) {
    console.error("讀取章節設定失敗：", error);
  }
}

function createChapterSelection() {
  // 先確保 chapterSelectDiv 清空
  chapterSelectDiv.querySelectorAll("label:not(:first-child)").forEach(el => el.remove());

  chapters.forEach((chap, idx) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = idx;
    checkbox.checked = true; // 預設全選

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(chap.name));
    chapterSelectDiv.appendChild(label);
  });
}

// --------------------------
// (2) 更新可用題庫ID
// --------------------------
function updateAvailableQuestionIDs() {
  availableQuestionIDs = [];
  const checkboxes = chapterSelectDiv.querySelectorAll("input[type='checkbox']:not(#selectAll):checked");
  checkboxes.forEach(chk => {
    const idx = parseInt(chk.value);
    const chap = chapters[idx];
    for (let i = chap.start; i <= chap.end; i++) {
      availableQuestionIDs.push(i.toString());
    }
  });

  const totalCount = availableQuestionIDs.length;
  questionCountInput.min = 1;
  questionCountInput.max = totalCount > 0 ? totalCount : 1;
  questionCountLabel.textContent = `請輸入題數（1-${totalCount}）：`;
  questionCountInput.value = totalCount > 0 ? totalCount : 1;
}

// --------------------------
// (3) 載入題庫 (ERPquestion.json)
// --------------------------
async function loadQuestions() {
  try {
    const response = await fetch("ERPquestion.json");
    if (!response.ok) {
      throw new Error("無法讀取題庫");
    }
    questionBank = await response.json();
    
  } catch (error) {
    console.error("讀取題庫失敗：", error);
  }
}

// --------------------------
// (4) 抽題
// --------------------------
function getRandomQuestions(num) {
  // 只打亂題號，不動選項 ABCD 順序
  const shuffled = availableQuestionIDs.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, num);
  usedQuestions = usedQuestions.concat(selected); 
  return selected;
}

// --------------------------
// (5) 渲染題目
// --------------------------
function renderQuestions() {
  questionsDiv.innerHTML = "";
  selectedQuestions.forEach((id, index) => {
    const q = questionBank[id];
    if (!q) return;
    const userAnswer = answers[index] || '';

    const questionDiv = document.createElement("div");
    questionDiv.className = "question";
    
    questionDiv.id = "q" + index;

    questionDiv.innerHTML = `
      <p><strong>${index+1}. ${q.question}</strong></p>
      <div class="options">
          <label><input type="radio" name="q${index}" value="A" ${userAnswer === 'A' ? 'checked' : ''}> A. ${q.A}</label>
          <label><input type="radio" name="q${index}" value="B" ${userAnswer === 'B' ? 'checked' : ''}> B. ${q.B}</label>
          <label><input type="radio" name="q${index}" value="C" ${userAnswer === 'C' ? 'checked' : ''}> C. ${q.C}</label>
          <label><input type="radio" name="q${index}" value="D" ${userAnswer === 'D' ? 'checked' : ''}> D. ${q.D}</label>
      </div>
    `;
    questionsDiv.appendChild(questionDiv);
    if (document.body.classList.contains("dark-mode")) {
      questionDiv.classList.add("dark-mode");
      document.querySelectorAll("label").forEach(label => label.classList.add("dark-mode"));
    }
  });
}

// --------------------------
// (6) 進度條
// --------------------------
function updateProgress() {
  const progress = document.querySelector(".progress");
  if (selectedQuestions.length === 0) {
    progress.style.width = '0%';
    return;
  }
  progress.style.width = `${(answeredCount / selectedQuestions.length) * 100}%`;
}

// --------------------------
// (7) 單頁顯示切換
// --------------------------
function showPage(pageEl) {
  mainPage.style.display      = "none";
  quizPage.style.display      = "none";
  reviewPage.style.display    = "none";
  allWrongPage.style.display  = "none";
  pageEl.style.display        = "block";
}

// --------------------------
// (8) 事件監聽 - DOMContentLoaded
// --------------------------
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("startbtn").disabled = true;
  // 先載入章節設定
  await loadChapters();
  // 讀取題庫
  await loadQuestions();
  // 渲染歷史
  renderHistory();
  // 一開始先隱藏 quizPage, reviewPage, allWrongPage
  showPage(mainPage);

  // 預設按鈕先禁用，等題庫載入完後再啟用
  document.getElementById("startbtn").disabled = false;
});

// --------------------------
// (9) checkbox 全選事件
// --------------------------
chapterSelectDiv.addEventListener("change", (e) => {
  if (e.target.id === "selectAll") {
    const isChecked = e.target.checked;
    const chapterCheckboxes = chapterSelectDiv.querySelectorAll("input[type='checkbox']:not(#selectAll)");
    chapterCheckboxes.forEach(cb => {
      cb.checked = isChecked;
    });
  }
  updateAvailableQuestionIDs();
});

// --------------------------
// (10) 快捷題數按鈕
// --------------------------
document.getElementById("qc_10").addEventListener("click", () => {
  questionCountInput.value = 10;
  console.log("qc_10 click");
});
document.getElementById("qc_50").addEventListener("click", () => {
  questionCountInput.value = 50;
});
document.getElementById("qc_100").addEventListener("click", () => {
  questionCountInput.value = 100;
});

// --------------------------
// (11) 開始測驗按鈕
// --------------------------

document.getElementById("startbtn").addEventListener("click", () => {
  console.log("startbtn click");

  const numQuestions = parseInt(questionCountInput.value);
  if (isNaN(numQuestions) || numQuestions < 1 || numQuestions > availableQuestionIDs.length) {
    alert(`請輸入 1 ~ ${availableQuestionIDs.length} 之間的數字`);
    return;
  }
  console.log("numQuestions", numQuestions);
  // 抽題
  selectedQuestions = getRandomQuestions(numQuestions);
  console.log("selectedQuestions", selectedQuestions);
  answers = {};
  correctAnswers = {};
  answeredCount = 0;
  selectedQuestions.forEach((id, index) => {
    if (questionBank[id]) {
      correctAnswers[index] = questionBank[id].ans;
    }
  });

  showPage(quizPage);
  renderQuestions();
  updateProgress();
  startTime = new Date();
  scoreDiv.innerHTML = "";

  // 按鈕狀態
  document.getElementById("submitBtn").style.display   = "inline-block";
  document.getElementById("continueBtn").style.display = "none";
  document.getElementById("cancelBtn").style.display = "inline-block";

  window.scrollTo({ top: 0 });
});
// --------------------------
// (11) 錯誤題目練習按鈕
// --------------------------
document.getElementById("ReCheckWrongBtn").addEventListener("click", () => {
  console.log("ReCheckWrongBtn click");

  const history = JSON.parse(localStorage.getItem("quizHistory")) || [];
  let wrongMap = {}; // { qid: [ rIndex1, rIndex2, ... ] }

  history.forEach((record, rIndex) => {
    if (!record.wrongQuestions) return;
    record.wrongQuestions.forEach(qid => {
      if (!wrongMap[qid]) wrongMap[qid] = [];
      wrongMap[qid].push(rIndex);
    });
  });
  // 排序題號
  let qids = Object.keys(wrongMap)
                   .map(x => parseInt(x))
                   .sort((a,b) => a - b);
  console.log("qids", qids);
  // 抽題
  const shuffled = qids.sort(() => Math.random() - 0.5);
  selectedQuestions = shuffled;
  console.log("selectedQuestions", shuffled);
  answers = {};
  correctAnswers = {};
  answeredCount = 0;
  selectedQuestions.forEach((id, index) => {
    if (questionBank[id]) {
      correctAnswers[index] = questionBank[id].ans;
    }
  });

  showPage(quizPage);
  renderQuestions();
  updateProgress();
  startTime = new Date();
  scoreDiv.innerHTML = "";

  // 按鈕狀態
  document.getElementById("submitBtn").style.display   = "inline-block";
  document.getElementById("continueBtn").style.display = "none";
  document.getElementById("cancelBtn").style.display = "inline-block";

  window.scrollTo({ top: 0 });
});
// --------------------------
// (11) 回顧>再試一次按鈕
// --------------------------
document.getElementById("ageinWrongBtn").addEventListener("click", () => {
  console.log("ageinWrongBtn click");
  const { questions } = now_history_object;
  let qValues = Object.values(questions)
  // 排序題號
  let qids = qValues.map(x => parseInt(x)).sort((a, b) => a - b);
  console.log("qids", qids);
  // 抽題
  const shuffled = qids.sort(() => Math.random() - 0.5);
  selectedQuestions = shuffled;
  console.log("selectedQuestions", shuffled);
  answers = {};
  correctAnswers = {};
  answeredCount = 0;
  selectedQuestions.forEach((id, index) => {
    if (questionBank[id]) {
      correctAnswers[index] = questionBank[id].ans;
    }
  });
  now_history_object = {}; // 清空
  showPage(quizPage);
  renderQuestions();
  updateProgress();
  startTime = new Date();
  scoreDiv.innerHTML = "";

  // 按鈕狀態
  document.getElementById("submitBtn").style.display   = "inline-block";
  document.getElementById("continueBtn").style.display = "none";
  document.getElementById("cancelBtn").style.display = "inline-block";

  window.scrollTo({ top: 0 });
});

// --------------------------
// (12) 作答事件
// --------------------------
document.addEventListener("change", (e) => {
  if (e.target.matches('input[type="radio"]')) {
    const questionId = e.target.name.replace("q", "");
    answers[questionId] = e.target.value;
    answeredCount = Object.keys(answers).length;
    updateProgress();

    // 改變區塊顏色
    
    const questionElement = document.getElementById("q" + questionId);
    if (questionElement) {
      questionElement.classList.add("fill");
      if (document.body.classList.contains("dark-mode")) {
        questionElement.classList.add("dark-mode");
      };
    }
   
  }
});

// --------------------------
// (13) 繳交答案
// --------------------------
document.getElementById("submitBtn").addEventListener("click", () => {
  const unansweredQuestions = selectedQuestions.filter((id, index) => !answers.hasOwnProperty(index));
  if (unansweredQuestions.length > 0) {
    const firstUnansweredQuestionIndex = selectedQuestions.indexOf(unansweredQuestions[0]);
    alert(`剩餘${unansweredQuestions.length}題尚未回答`);
    setTimeout(() => {
      const questionElement = document.getElementById("q" + firstUnansweredQuestionIndex);
      if (questionElement) {
        questionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 0);
    return;
  }

  endTime = new Date();
  const totalTime = ((endTime - startTime) / 1000).toFixed(2);
  const avgTime = (totalTime / selectedQuestions.length).toFixed(2);

  let score = 0;
  let wrongQuestions = [];
  selectedQuestions.forEach((id, index) => {
    const questionDiv = document.getElementById("q" + index);
    const userAnswer = answers[index];
    const correctAnswer = correctAnswers[index];

    if (userAnswer === correctAnswer) {
      score++;
    } else {
      questionDiv.classList.add("incorrect");
      wrongQuestions.push(id);

      // 標示正解
      const options = questionDiv.querySelectorAll(".options label");
      options.forEach(label => {
        const input = label.querySelector('input');
        if (input.value === correctAnswer) {
          label.classList.add("correct-answer");
        }
      });
      if (document.body.classList.contains("dark-mode")) {
        options.forEach(label => label.classList.add("dark-mode"));
      }
    }
  });

  // 檢查並添加 dark-mode 類
  document.querySelectorAll(".correct-answer").forEach(label => {
    if (document.body.classList.contains("dark-mode")) {
      label.classList.add("dark-mode");
    } else {
      label.classList.remove("dark-mode");
    }
  });

  scoreDiv.innerHTML = `你的分數是：${score} / ${selectedQuestions.length}<br>
                        總用時：${totalTime} 秒，平均每題 ${avgTime} 秒`;

  // 保存到歷史
  saveHistory({
    date: new Date().toLocaleString(),
    score: `${score} / ${selectedQuestions.length}`,
    time: `${totalTime} 秒`,
    totalTime: totalTime,
    questions: selectedQuestions.slice(),
    wrongQuestions: wrongQuestions,
    answers: { ...answers }
  });

  // 按鈕狀態
  document.getElementById("submitBtn").style.display   = "none";
  document.getElementById("cancelBtn").style.display = "none";
  document.getElementById("continueBtn").style.display = "inline-block";
});

// --------------------------
// (14) 繼續 (返回主頁)
// --------------------------
document.getElementById("continueBtn").addEventListener("click", () => {
  showPage(mainPage);
  questionsDiv.innerHTML = "";
  scoreDiv.innerHTML = "";
  selectedQuestions = [];
  answers = {};
  correctAnswers = {};
  answeredCount = 0;
  updateProgress();
  window.scrollTo({ top: 0 });
});
// --------------------------
// (14-2) 取消 (返回主頁)
// --------------------------
document.getElementById("cancelBtn").addEventListener("click", () => {
  showPage(mainPage);
  questionsDiv.innerHTML = "";
  scoreDiv.innerHTML = "";
  selectedQuestions = [];
  answers = {};
  correctAnswers = {};
  answeredCount = 0;
  updateProgress();
  window.scrollTo({ top: 0 });
});

// --------------------------
// (15) 回顧所有錯題按鈕
// --------------------------
document.getElementById("reviewAllWrongBtn").addEventListener("click", () => {
  reviewFromAllWrong = false;
  renderAllWrongPage();
  showPage(allWrongPage);
  window.scrollTo({ top: 0 });
});

// --------------------------
// (16) 錯題回顧頁 - 返回
// --------------------------
document.getElementById("backToMainPageFromWrong").addEventListener("click", () => {
  showPage(mainPage);
  window.scrollTo({ top: 0 });
});

// --------------------------
// (17) 回顧頁 (顯示單次測驗紀錄)
// --------------------------
function showReviewPage(historyRecord) {
  if (reviewFromAllWrong) {
    // 來自錯題回顧
    document.getElementById("backToMainPageBtn").textContent = "返回上一頁";
  } else {
    document.getElementById("backToMainPageBtn").textContent = "返回初始頁面";
  }

  reviewHeader.textContent = `[${historyRecord.date} ${historyRecord.score} ${historyRecord.time}]`;
  toggleWrongBtn.dataset.showMode = "all"; 
  toggleWrongBtn.textContent = "顯示錯誤題目";

  renderReviewQuestions(historyRecord, "all");
  showPage(reviewPage);
  window.scrollTo({ top: 0 });
}

// 切換顯示錯題/全部
toggleWrongBtn.addEventListener("click", () => {
  const rec = getTempHistoryRecord();
  if (!rec) return;
  const mode = toggleWrongBtn.dataset.showMode;
  if (mode === "all") {
    toggleWrongBtn.dataset.showMode = "wrong";
    toggleWrongBtn.textContent = "顯示全部";
    renderReviewQuestions(rec, "wrong");
  } else {
    toggleWrongBtn.dataset.showMode = "all";
    toggleWrongBtn.textContent = "顯示錯誤題目";
    renderReviewQuestions(rec, "all");
  }
});

// --------------------------
// (18) 回顧頁 - 返回初始頁面 or 返回上一頁
// 加入 setTimeout 修正捲動問題
// --------------------------
document.getElementById("backToMainPageBtn").addEventListener("click", () => {
  if (reviewFromAllWrong) {
    // 回到錯題回顧頁
    showPage(allWrongPage);
    reviewFromAllWrong = false;

    // 重新渲染錯題頁(確保 DOM 存在)
    renderAllWrongPage();

    // 延遲一點時間再捲動
    setTimeout(() => {
      const savedQid = sessionStorage.getItem("allWrongScrollQid");
      if (savedQid) {
        const blockEl = document.getElementById("wrong-qid-" + savedQid);
        if (blockEl) {
          blockEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        sessionStorage.removeItem("allWrongScrollQid");
      }
    }, 100);

  } else {
    showPage(mainPage);
  }
  window.scrollTo({ top: 0 });
});

// --------------------------
// (19) 渲染回顧頁 (單次測驗)
// --------------------------
function renderReviewQuestions(historyRecord, mode) {
  reviewQuestionsDiv.innerHTML = "";
  const { questions, wrongQuestions } = historyRecord;

  questions.forEach((qid) => {
    if (mode === "wrong" && !wrongQuestions.includes(qid)) return;
    const q = questionBank[qid];
    if (!q) return;

    const isWrong = wrongQuestions.includes(qid);
    const div = document.createElement("div");
    div.className = "question-block";
    if (isWrong) div.classList.add("incorrect");
    if (document.body.classList.contains("dark-mode")) {
      if (isWrong) div.classList.add("dark-mode");
      div.innerHTML = `
      <p><strong>(${qid}題) ${q.question}</strong></p>
      <p>A. ${q.A}</p>
      <p>B. ${q.B}</p>
      <p>C. ${q.C}</p>
      <p>D. ${q.D}</p>
      <p class="ans_color dark-mode" >正解：${q.ans}</p>
    `;
    }else{
      div.innerHTML = `
      <p><strong>(${qid}題) ${q.question}</strong></p>
      <p>A. ${q.A}</p>
      <p>B. ${q.B}</p>
      <p>C. ${q.C}</p>
      <p>D. ${q.D}</p>
      <p class="ans_color">正解：${q.ans}</p>
    `;
    };
   

    
    reviewQuestionsDiv.appendChild(div);
  });
}

// --------------------------
// (20) 回顧所有錯題 - 渲染
// --------------------------
function renderAllWrongPage() {
  allWrongListDiv.innerHTML = "";
  
  const history = JSON.parse(localStorage.getItem("quizHistory")) || [];
  let wrongMap = {}; // { qid: [ rIndex1, rIndex2, ... ] }

  history.forEach((record, rIndex) => {
    if (!record.wrongQuestions) return;
    record.wrongQuestions.forEach(qid => {
      if (!wrongMap[qid]) wrongMap[qid] = [];
      wrongMap[qid].push(rIndex);
    });
  });

  // 排序題號
  let qids = Object.keys(wrongMap)
                   .map(x => parseInt(x))
                   .sort((a,b) => a - b);

  qids.forEach(qid => {
    const q = questionBank[qid];
    if (!q) return;

    const block = document.createElement("div");
    block.className = "question-block";
    block.id = "wrong-qid-" + qid; // 用於 scrollIntoView

    block.classList.add("incorrect");
    if (document.body.classList.contains("dark-mode")) {
      block.classList.add("dark-mode");
      block.innerHTML = ` 
      <p><strong>(${qid}題) ${q.question}</strong></p>
      <p>A. ${q.A}</p>
      <p>B. ${q.B}</p>
      <p>C. ${q.C}</p>
      <p>D. ${q.D}</p>
      <p class="ans_color dark-mode" >正解：${q.ans}</p>
    `;
    }else{
      block.innerHTML = `
      <p><strong>(${qid}題) ${q.question}</strong></p>
      <p>A. ${q.A}</p>
      <p>B. ${q.B}</p>
      <p>C. ${q.C}</p>
      <p>D. ${q.D}</p>
      <p class="ans_color">正解：${q.ans}</p>
    `;
    };
   
    // 列出多筆出錯紀錄
    wrongMap[qid].forEach(rIndex => {
      const rec = history[rIndex];
      const p = document.createElement("p");
      p.style.marginTop = "5px";
      // 小按鈕
      p.innerHTML = `
        出現於：${rec.date} / 成績：${rec.score} / 用時：${rec.time}
        &nbsp;&nbsp;
        <button class="button button-inline" data-review="${rIndex}" data-qid="${qid}">回顧</button>
        <button class="button button-inline" data-delete="${rIndex}" data-qid="${qid}">刪除</button>
      `;
      block.appendChild(p);
    });
    allWrongListDiv.appendChild(block);
  });
  if (document.body.classList.contains("dark-mode")) {
    document.querySelectorAll(".button-inline").forEach(buttoninline => buttoninline.classList.add("dark-mode"));
  }
}

// --------------------------
// (21) 錯題回顧 - 監聽「回顧」「刪除」
// --------------------------
allWrongListDiv.addEventListener("click", (e) => {

  const target = e.target;
  const history = JSON.parse(localStorage.getItem("quizHistory")) || [];
  if (target.dataset.review) {
    const idx = parseInt(target.dataset.review);
    const qid = target.dataset.qid;
    if (!isNaN(idx) && history[idx]) {
      reviewFromAllWrong = true;
      setTempHistoryRecord(history[idx]);

      // 存下此題題號，回顧完後可捲動回此題
      sessionStorage.setItem("allWrongScrollQid", qid);

      showReviewPage(history[idx]);
    }
  } else if (target.dataset.delete) {
    const idx = parseInt(target.dataset.delete);
    if (!isNaN(idx) && history[idx]) {
      history.splice(idx, 1);
      localStorage.setItem("quizHistory", JSON.stringify(history));
      // 重新渲染
      renderAllWrongPage();
      renderHistory();
    }
  }
  if (document.body.classList.contains("dark-mode")) {
    document.querySelectorAll(".button-inline").forEach(buttoninline => buttoninline.classList.add("dark-mode"));
  }
});

// --------------------------
// (22) 歷史紀錄存取
// --------------------------
function saveHistory(record) {
  const history = JSON.parse(localStorage.getItem("quizHistory")) || [];
  history.push(record);
  localStorage.setItem("quizHistory", JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem("quizHistory")) || [];
  historyList.innerHTML = "";

  history.reverse().forEach((rec, index) => {
    const li = document.createElement("li");
    li.innerText = `${rec.date} - 分數：${rec.score}，用時：${rec.time}`;

    const btnReview = document.createElement("button");
    btnReview.className = "button button-inline";
    btnReview.textContent = "回顧";
    btnReview.addEventListener("click", () => {
      console.log("回顧", rec);
      now_history_object = rec;
      reviewFromAllWrong = false;
      setTempHistoryRecord(rec);
      showReviewPage(rec);
      
    });

    const btnDelete = document.createElement("button");
    btnDelete.className = "button button-inline";
    btnDelete.textContent = "刪除";
    btnDelete.addEventListener("click", () => {
      history.splice(index, 1);
      localStorage.setItem("quizHistory", JSON.stringify(history));
      renderHistory();
    });

    li.appendChild(document.createElement("br"));
    li.appendChild(btnReview);
    li.appendChild(btnDelete);
    historyList.appendChild(li);
    
  });
  if (document.body.classList.contains("dark-mode")) {
    document.querySelectorAll(".button-inline").forEach(buttoninline => buttoninline.classList.add("dark-mode"));
  }
}

// --------------------------
// (23) 暫存回顧紀錄
// --------------------------
function setTempHistoryRecord(record) {
  sessionStorage.setItem("tempRecord", JSON.stringify(record));
}
function getTempHistoryRecord() {
  const data = sessionStorage.getItem("tempRecord");
  if (!data) return null;
  return JSON.parse(data);
}
document.getElementById("toggleDarkMode").addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  document.querySelectorAll(".container").forEach(container => container.classList.toggle("dark-mode"));
  document.querySelectorAll("h1, h3, h5, h6").forEach(header => header.classList.toggle("dark-mode"));
  document.querySelectorAll(".progress-bar").forEach(progressBar => progressBar.classList.toggle("dark-mode"));
  document.querySelectorAll(".question").forEach(question => question.classList.toggle("dark-mode"));
  document.querySelectorAll(".button").forEach(button => button.classList.toggle("dark-mode"));
  document.querySelectorAll(".score").forEach(score => score.classList.toggle("dark-mode"));
  document.querySelectorAll(".history h2").forEach(historyHeader => historyHeader.classList.toggle("dark-mode"));
  document.querySelectorAll(".review-header").forEach(reviewHeader => reviewHeader.classList.toggle("dark-mode"));
  document.querySelectorAll(".question-block").forEach(questionBlock => questionBlock.classList.toggle("dark-mode"));
  document.querySelectorAll(".ans_color").forEach(anscolor => anscolor.classList.toggle("dark-mode"));
  document.querySelectorAll(".correct-answer").forEach(correctAnswer => correctAnswer.classList.toggle("dark-mode"));
  const toggleButton = document.getElementById("toggleDarkMode");
  if (toggleButton.textContent === "B") {
    toggleButton.textContent = "W";
  } else {
    toggleButton.textContent = "B";
  }
});