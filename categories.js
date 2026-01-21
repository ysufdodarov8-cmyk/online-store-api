const express = require("express");
const router = express.Router();
const { pool } = require("../db/db.js");
router.get("/get-category", async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, categoryname AS "categoryName", image FROM categories ORDER BY id ASC',
    );
    res.json({ categories: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
router.post("/add-category", async (req, res) => {
  const { categoryName, images } = req.body;
  if (!categoryName || !images || images.length === 0)
    return res
      .status(400)
      .json({ message: "CategoryName and image are required" });
  try {
    const result = await pool.query(
      'INSERT INTO categories (categoryname, image) VALUES ($1, $2) RETURNING id, categoryname AS "categoryName", image',
      [categoryName, images[0]],
    );
    res.json({
      message: "Category added successfully",
      category: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/update-category/:id", async (req, res) => {
  const { id } = req.params;
  const { nameCategory, newImage } = req.body;
  if (!nameCategory)
    return res.status(400).json({ message: "New category name is required" });
  try {
    const result = await pool.query(
      'UPDATE categories SET categoryname=$1, image=COALESCE($2,image) WHERE id=$3 RETURNING id, categoryname AS "categoryName", image',
      [nameCategory, newImage, id],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: "Category not found" });

    res.json({
      message: "Category updated successfully",
      category: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/delete-category/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM categories WHERE id=$1 RETURNING id, categoryname AS "categoryName", image',
      [id],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: "Category not found" });
    res.json({
      message: "Category deleted successfully",
      category: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
