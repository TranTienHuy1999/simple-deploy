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

const todoSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    done: { type: Boolean, default: false },
  },
  { timestamps: true }
);
const Todo = mongoose.model("Todo", todoSchema);

app.get("/api/todos", async (req, res) => {
  const todos = await Todo.find().sort({ createdAt: -1 });
  res.json(todos);
});

app.post("/api/todos", async (req, res) => {
  try {
    const todo = await Todo.create({ text: req.body.text });
    res.status(201).json(todo);
  } catch (err) {
    res.status(400).json({ error: "Dữ liệu không hợp lệ" });
  }
});

app.patch("/api/todos/:id", async (req, res) => {
  const todo = await Todo.findByIdAndUpdate(
    req.params.id,
    { done: req.body.done },
    { new: true }
  );
  if (!todo) return res.status(404).json({ error: "Không tìm thấy" });
  res.json(todo);
});

app.delete("/api/todos/:id", async (req, res) => {
  await Todo.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
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