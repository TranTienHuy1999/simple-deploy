// ====== CẤU HÌNH ======
// Thay bằng URL backend sau khi deploy lên Render (không có dấu / ở cuối).
// Khi chạy thử trên máy, dùng: "http://localhost:3000"

const API_URL = "https://simple-deploy-de2c.onrender.com";
// const API_URL = "http://localhost:3000";

// ====== HÀM HỖ TRỢ ======
function formatRemaining(ms) {
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const seconds = Math.floor((ms / 1000) % 60);
  return `${days} ngày ${hours} giờ ${minutes} phút ${seconds} giây`;
}

// Chuyển chuỗi ISO (UTC) thành giá trị cho <input type="datetime-local"> theo giờ máy
function toLocalInput(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString("vi-VN");
}

// Gọi API, tự báo lỗi nếu máy chủ trả về mã lỗi
async function api(path, options = {}) {
  const config = { ...options };
  if (options.body) {
    config.headers = { "Content-Type": "application/json" };
  }
  const res = await fetch(`${API_URL}${path}`, config);
  if (!res.ok) {
    let message = "Lỗi máy chủ";
    try {
      const data = await res.json();
      if (data.error) message = data.error;
    } catch (e) {}
    throw new Error(message);
  }
  return res.json();
}

// ====== ĐẾM NGƯỢC (giữ nguyên) ======
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
  countdownDisplay.textContent = formatRemaining(diff);
}

// ====== TO-DO LIST ======
const todoInput = document.getElementById("todoInput");
const dueInput = document.getElementById("dueInput");
const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const formBox = document.getElementById("formBox");
const formTitle = document.getElementById("formTitle");
const tabActive = document.getElementById("tabActive");
const tabTrash = document.getElementById("tabTrash");
const emptyTrashBtn = document.getElementById("emptyTrashBtn");
const todoList = document.getElementById("todoList");
const statusText = document.getElementById("status");

let currentView = "active"; // "active" hoặc "trash"
let editingId = null; // id công việc đang sửa (null = đang ở chế độ thêm)
let cachedTodos = [];

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.className = isError ? "status error" : "status";
}

// ----- READ -----
async function loadTodos() {
  try {
    const inTrash = currentView === "trash";
    cachedTodos = await api(`/api/todos?trash=${inTrash}`);
    renderTodos();
    if (cachedTodos.length === 0) {
      setStatus(inTrash ? "Thùng rác trống." : "Chưa có công việc nào.");
    } else {
      setStatus("");
    }
  } catch (err) {
    setStatus("Không tải được dữ liệu: " + err.message, true);
  }
}

function renderTodos() {
  todoList.innerHTML = "";
  const inTrash = currentView === "trash";

  cachedTodos.forEach((todo) => {
    const li = document.createElement("li");
    if (todo.done && !inTrash) li.classList.add("done");

    // Ô tích hoàn thành (chỉ ở tab công việc)
    if (!inTrash) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = todo.done;
      checkbox.addEventListener("change", () => toggleDone(todo._id, checkbox.checked));
      li.appendChild(checkbox);
    }

    // Thông tin công việc
    const info = document.createElement("div");
    info.className = "info";

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = todo.text; // dùng textContent để tránh chèn mã HTML độc hại

    const meta = document.createElement("div");
    meta.className = "meta";
    if (todo.dueAt) {
      meta.append("Hẹn giờ: " + formatDate(todo.dueAt));
      if (!inTrash) {
        const remaining = document.createElement("span");
        remaining.className = "remaining";
        remaining.dataset.due = todo.dueAt;
        remaining.dataset.done = String(todo.done);
        meta.append(" • ", remaining);
      }
    } else {
      meta.textContent = "Chưa có thời gian hẹn giờ";
    }

    info.append(title, meta);
    li.appendChild(info);

    // Nút thao tác
    const actions = document.createElement("div");
    actions.className = "actions";

    if (!inTrash) {
      actions.append(
        makeButton("Sửa", "gray small", () => startEdit(todo._id)),
        makeButton("Xóa", "danger small", () => moveToTrash(todo._id))
      );
    } else {
      actions.append(
        makeButton("Khôi phục", "green small", () => restoreTodo(todo._id)),
        makeButton("Xóa vĩnh viễn", "danger small", () => deleteForever(todo._id))
      );
    }
    li.appendChild(actions);
    todoList.appendChild(li);
  });

  updateTaskTimers();
}

function makeButton(label, className, onClick) {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.className = className;
  btn.addEventListener("click", onClick);
  return btn;
}

// Cập nhật thời gian còn lại của từng công việc (chạy mỗi giây)
function updateTaskTimers() {
  document.querySelectorAll(".remaining").forEach((el) => {
    if (el.dataset.done === "true") {
      el.textContent = "Đã hoàn thành";
      el.className = "remaining finished";
      return;
    }
    const diff = new Date(el.dataset.due).getTime() - Date.now();
    if (diff <= 0) {
      el.textContent = "Đã quá hạn";
      el.className = "remaining overdue";
    } else {
      el.textContent = "Còn " + formatRemaining(diff);
      el.className = "remaining";
    }
  });
}

// ----- CREATE + UPDATE (dùng chung một form) -----
async function submitTodo() {
  const text = todoInput.value.trim();
  if (!text) {
    alert("Vui lòng nhập nội dung công việc.");
    return;
  }
  if (!dueInput.value) {
    alert("Vui lòng chọn thời gian hẹn giờ.");
    return;
  }
  const due = new Date(dueInput.value);
  if (!editingId && due.getTime() <= Date.now()) {
    alert("Thời gian hẹn giờ phải ở tương lai.");
    return;
  }

  // Gửi lên máy chủ dưới dạng ISO (UTC) để không bị lệch múi giờ
  const body = JSON.stringify({ text, dueAt: due.toISOString() });

  try {
    submitBtn.disabled = true;
    if (editingId) {
      await api(`/api/todos/${editingId}`, { method: "PUT", body });
    } else {
      await api("/api/todos", { method: "POST", body });
    }
    resetForm();
    await loadTodos();
  } catch (err) {
    setStatus("Lưu thất bại: " + err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
}

function startEdit(id) {
  const todo = cachedTodos.find((t) => t._id === id);
  if (!todo) return;
  editingId = id;
  todoInput.value = todo.text;
  dueInput.value = todo.dueAt ? toLocalInput(todo.dueAt) : "";
  formTitle.textContent = "Sửa công việc";
  submitBtn.textContent = "Lưu thay đổi";
  cancelEditBtn.style.display = "inline-block";
  formBox.classList.add("editing");
  todoInput.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  editingId = null;
  todoInput.value = "";
  dueInput.value = "";
  formTitle.textContent = "Thêm công việc mới";
  submitBtn.textContent = "Thêm";
  cancelEditBtn.style.display = "none";
  formBox.classList.remove("editing");
}

// ----- UPDATE: hoàn thành -----
async function toggleDone(id, done) {
  try {
    await api(`/api/todos/${id}`, { method: "PATCH", body: JSON.stringify({ done }) });
    await loadTodos();
  } catch (err) {
    setStatus("Cập nhật thất bại: " + err.message, true);
  }
}

// ----- DELETE (xóa mềm): chuyển vào thùng rác -----
async function moveToTrash(id) {
  try {
    await api(`/api/todos/${id}/trash`, { method: "PATCH" });
    if (editingId === id) resetForm();
    await loadTodos();
  } catch (err) {
    setStatus("Chuyển vào thùng rác thất bại: " + err.message, true);
  }
}

async function restoreTodo(id) {
  try {
    await api(`/api/todos/${id}/restore`, { method: "PATCH" });
    await loadTodos();
  } catch (err) {
    setStatus("Khôi phục thất bại: " + err.message, true);
  }
}

// ----- DELETE (xóa thật): chỉ thực hiện trong thùng rác -----
async function deleteForever(id) {
  if (!confirm("Xóa vĩnh viễn công việc này? Không thể khôi phục.")) return;
  try {
    await api(`/api/todos/${id}`, { method: "DELETE" });
    await loadTodos();
  } catch (err) {
    setStatus("Xóa thất bại: " + err.message, true);
  }
}

async function emptyTrash() {
  if (!confirm("Xóa vĩnh viễn TẤT CẢ công việc trong thùng rác?")) return;
  try {
    await api("/api/trash", { method: "DELETE" });
    await loadTodos();
  } catch (err) {
    setStatus("Dọn thùng rác thất bại: " + err.message, true);
  }
}

// ----- Chuyển tab -----
function switchView(view) {
  currentView = view;
  resetForm();
  tabActive.classList.toggle("active", view === "active");
  tabTrash.classList.toggle("active", view === "trash");
  emptyTrashBtn.style.display = view === "trash" ? "inline-block" : "none";
  formBox.style.display = view === "trash" ? "none" : "block";
  setStatus("Đang tải...");
  loadTodos();
}

// ====== SỰ KIỆN ======
submitBtn.addEventListener("click", submitTodo);
cancelEditBtn.addEventListener("click", resetForm);
todoInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitTodo();
});
tabActive.addEventListener("click", () => switchView("active"));
tabTrash.addEventListener("click", () => switchView("trash"));
emptyTrashBtn.addEventListener("click", emptyTrash);

// ====== KHỞI ĐỘNG ======
updateCountdown();
setInterval(() => {
  updateCountdown();
  updateTaskTimers();
}, 1000);
loadTodos();