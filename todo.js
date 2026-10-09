// ====== CẤU HÌNH ======
// Thay bằng URL backend sau khi deploy lên Render (không có dấu / ở cuối).
// Khi chạy thử trên máy, dùng: "http://localhost:3000"
const API_URL = "https://ten-service.onrender.com";

// ====== ĐẾM NGƯỢC ======
const targetInput = document.getElementById("targetInput");
const setTargetBtn = document.getElementById("setTargetBtn");
const countdownDisplay = document.getElementById("countdownDisplay");

let targetTime = localStorage.getItem("targetTime");
if (targetTime) {
  targetInput.value = targetTime;
}

setTargetBtn.addEventListener("click", () => {
  if (!targetInput.value) {
    alert("Vui lòng chọn thời điểm.");
    return;
  }
  targetTime = targetInput.value;
  localStorage.setItem("targetTime", targetTime);
  updateCountdown();
});

function updateCountdown() {
  if (!targetTime) {
    countdownDisplay.textContent = "Chưa thiết lập";
    return;
  }
  const diff = new Date(targetTime).getTime() - Date.now();
  if (isNaN(diff)) {
    countdownDisplay.textContent = "Thời điểm không hợp lệ";
    return;
  }
  if (diff <= 0) {
    countdownDisplay.textContent = "Đã đến thời điểm!";
    return;
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  countdownDisplay.textContent =
    `${days} ngày ${hours} giờ ${minutes} phút ${seconds} giây`;
}

updateCountdown();
setInterval(updateCountdown, 1000);

// ====== TO-DO LIST (lưu vào MongoDB Atlas qua backend) ======
const todoInput = document.getElementById("todoInput");
const addBtn = document.getElementById("addBtn");
const todoList = document.getElementById("todoList");
const statusText = document.getElementById("status");

async function loadTodos() {
  try {
    const res = await fetch(`${API_URL}/api/todos`);
    if (!res.ok) throw new Error("Lỗi máy chủ");
    const todos = await res.json();
    renderTodos(todos);
    statusText.textContent = "";
  } catch (err) {
    statusText.textContent = "Không tải được dữ liệu. Kiểm tra lại backend.";
  }
}

function renderTodos(todos) {
  todoList.innerHTML = "";
  todos.forEach((todo) => {
    const li = document.createElement("li");
    if (todo.done) li.classList.add("done");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.done;
    checkbox.addEventListener("change", () => toggleTodo(todo._id, checkbox.checked));

    const span = document.createElement("span");
    span.textContent = todo.text;

    const delBtn = document.createElement("button");
    delBtn.textContent = "Xóa";
    delBtn.className = "danger";
    delBtn.addEventListener("click", () => deleteTodo(todo._id));

    li.append(checkbox, span, delBtn);
    todoList.appendChild(li);
  });
}

async function addTodo() {
  const text = todoInput.value.trim();
  if (!text) return;
  try {
    const res = await fetch(`${API_URL}/api/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error("Lỗi thêm");
    todoInput.value = "";
    loadTodos();
  } catch (err) {
    statusText.textContent = "Thêm thất bại. Thử lại sau.";
  }
}

async function toggleTodo(id, done) {
  await fetch(`${API_URL}/api/todos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ done }),
  });
  loadTodos();
}

async function deleteTodo(id) {
  await fetch(`${API_URL}/api/todos/${id}`, { method: "DELETE" });
  loadTodos();
}

addBtn.addEventListener("click", addTodo);
todoInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addTodo();
});

loadTodos();