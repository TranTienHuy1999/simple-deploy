require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3000;

// Chỉ cho phép trang GitHub Pages gọi API.
// Ví dụ: ALLOWED_ORIGIN=https://ten-cua-ban.github.io
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || "*" }));
app.use(express.json());

// ====== MODEL ======
const todoSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 200 },
    dueAt: { type: Date, required: true }, // thời gian hẹn giờ
    done: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false }, // true = đang nằm trong thùng rác
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
const Todo = mongoose.model("Todo", todoSchema);

// ====== HÀM HỖ TRỢ ======
// Bắt lỗi của hàm async để không làm sập server
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Kiểm tra :id có đúng định dạng ObjectId không
function checkId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "ID không hợp lệ" });
  }
  next();
}

function parseDate(value) {
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// ====== API ======

// READ: danh sách. ?trash=true -> thùng rác, mặc định -> công việc đang hoạt động
app.get(
  "/api/todos",
  wrap(async (req, res) => {
    const inTrash = req.query.trash === "true";
    // Dùng $ne:true để vẫn lấy được các bản ghi cũ chưa có trường "deleted"
    const filter = inTrash ? { deleted: true } : { deleted: { $ne: true } };
    const sort = inTrash ? { deletedAt: -1 } : { done: 1, dueAt: 1 };
    const todos = await Todo.find(filter).sort(sort);
    res.json(todos);
  })
);

// CREATE: thêm công việc mới (bắt buộc có text và dueAt)
app.post(
  "/api/todos",
  wrap(async (req, res) => {
    const text = (req.body.text || "").trim();
    const dueAt = parseDate(req.body.dueAt);
    if (!text) return res.status(400).json({ error: "Nội dung không được để trống" });
    if (!dueAt) return res.status(400).json({ error: "Thời gian hẹn giờ không hợp lệ" });
    const todo = await Todo.create({ text, dueAt });
    res.status(201).json(todo);
  })
);

// UPDATE: sửa nội dung và thời gian hẹn giờ
app.put(
  "/api/todos/:id",
  checkId,
  wrap(async (req, res) => {
    const text = (req.body.text || "").trim();
    const dueAt = parseDate(req.body.dueAt);
    if (!text) return res.status(400).json({ error: "Nội dung không được để trống" });
    if (!dueAt) return res.status(400).json({ error: "Thời gian hẹn giờ không hợp lệ" });
    const todo = await Todo.findOneAndUpdate(
      { _id: req.params.id, deleted: { $ne: true } },
      { text, dueAt },
      { new: true, runValidators: true }
    );
    if (!todo) return res.status(404).json({ error: "Không tìm thấy công việc" });
    res.json(todo);
  })
);

// UPDATE: đánh dấu hoàn thành / chưa hoàn thành
app.patch(
  "/api/todos/:id",
  checkId,
  wrap(async (req, res) => {
    if (typeof req.body.done !== "boolean") {
      return res.status(400).json({ error: "Trường done phải là true/false" });
    }
    const todo = await Todo.findOneAndUpdate(
      { _id: req.params.id, deleted: { $ne: true } },
      { done: req.body.done },
      { new: true }
    );
    if (!todo) return res.status(404).json({ error: "Không tìm thấy công việc" });
    res.json(todo);
  })
);

// XÓA MỀM: chuyển vào thùng rác (không xóa khỏi database)
app.patch(
  "/api/todos/:id/trash",
  checkId,
  wrap(async (req, res) => {
    const todo = await Todo.findByIdAndUpdate(
      req.params.id,
      { deleted: true, deletedAt: new Date() },
      { new: true }
    );
    if (!todo) return res.status(404).json({ error: "Không tìm thấy công việc" });
    res.json(todo);
  })
);

// KHÔI PHỤC: đưa từ thùng rác về lại danh sách
app.patch(
  "/api/todos/:id/restore",
  checkId,
  wrap(async (req, res) => {
    const todo = await Todo.findByIdAndUpdate(
      req.params.id,
      { deleted: false, deletedAt: null },
      { new: true }
    );
    if (!todo) return res.status(404).json({ error: "Không tìm thấy công việc" });
    res.json(todo);
  })
);

// DỌN THÙNG RÁC: xóa vĩnh viễn toàn bộ mục trong thùng rác
app.delete(
  "/api/trash",
  wrap(async (req, res) => {
    const result = await Todo.deleteMany({ deleted: true });
    res.json({ ok: true, deletedCount: result.deletedCount });
  })
);

// XÓA VĨNH VIỄN một mục: chỉ cho phép nếu mục đang nằm trong thùng rác
app.delete(
  "/api/todos/:id",
  checkId,
  wrap(async (req, res) => {
    const todo = await Todo.findOneAndDelete({ _id: req.params.id, deleted: true });
    if (!todo) {
      return res
        .status(404)
        .json({ error: "Chỉ xóa vĩnh viễn được công việc đang nằm trong thùng rác" });
    }
    res.json({ ok: true });
  })
);

// Xử lý lỗi chung
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Lỗi máy chủ" });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Đã kết nối MongoDB Atlas");
    app.listen(PORT, () => console.log(`Server chạy tại cổng ${PORT}`));
  })
  .catch((err) => {
    console.error("Lỗi kết nối MongoDB:", err.message);
    process.exit(1);
  });